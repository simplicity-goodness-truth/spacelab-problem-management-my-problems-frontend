sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "../utils/sharedLibrary",
    "sap/m/library"
], function (BaseController, JSONModel, formatter, sharedLibrary, mobileLibrary) {
    "use strict";

    // shortcut for sap.m.URLHelper
    var URLHelper = mobileLibrary.URLHelper;

    return BaseController.extend("yslpmmyprb.controller.Detail", {

        formatter: formatter,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        onInit: function () {
            // Model used to manipulate control states. The chosen values make sure,
            // detail page is busy indication immediately so there is no break in
            // between the busy indication for loading the view's meta data
            var oViewModel = new JSONModel({
                busy: false,
                delay: 0,
                lineItemListTitle: this.getResourceBundle().getText("detailLineItemTableHeading")
            });

            this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
            this.setModel(oViewModel, "detailView");
            this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));

            // Event bus for events publishing
            this.oEventBus = sap.ui.getCore().getEventBus();

            //  Problem closure payload      
            this.problemClosurePayload = {};

            //  Runtime model
            var oRuntimeModel = new JSONModel({
                editModeActive: false
            });
            this.getOwnerComponent().setModel(oRuntimeModel, "runtimeModel");

            // Bus for events from a list
            var oEventBus = sap.ui.getCore().getEventBus();
            // 1. ChannelName, 2. EventName, 3. Function to be executed, 4. Listener
            oEventBus.subscribe("ListAction", "onRefreshDetailFromList", this.onRefreshDetailFromList, this);

            // Disable drag and drop for UploadSet, as it is 
            // not working properly, when not supported
            // file type/media is supported

            this._disableUploadSetDragAndDrop();

            // Getting frontend constants

            this.oFrontendConstants = this.getOwnerComponent().getModel("frontendConstants");

            // Filling status names constants

            this.statusNames = Object.freeze(this._setStatusNamesConstants());

            // Filling text types constants

            this.textTypes = Object.freeze(this._setTextTypesConstants());


        },

        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */

        /**
        * Processor pressed OK inside dispute comment dialog
        */
        onProblemDisputeCommentDialogEntered: function () {

            var t = this,
                sDisputeCommentText = this._getProblemDisputeDialogText();

            if (sDisputeCommentText.length != '0') {

                t._destroyProblemDisputeComment();

                var sTdid = t.textTypes.reply;

                t._createProblemText(t.Guid, sTdid, sDisputeCommentText, function () {

                    switch (t.problemDisputeAction) {

                        case 'Open':

                            t._executeProblemDisputeOpening();

                            break;

                    }

                });

            } else {

                switch (t.problemDisputeAction) {

                    case 'Open':

                        sap.m.MessageBox.error(t.getResourceBundle().getText("disputeOpeningCommentMissing"));

                        break;

                }

            }

        },

        /**
        * Processor pressed Cancel inside dispute comment dialog
        */
        onCloseProblemDisputeCommentDialog: function () {

            this._destroyProblemDisputeComment();
        },

        /**
        * Requester pressed a dispute history icon
        */
        onPressDisputeOpenIcon: function () {

            this._openDisputeHistoryDialog();

        },

        /**
        * Closing a dispute history 
        */
        onCloseDisputeHistoryDialog: function () {

            this._destroyDisputeHistoryDialog();

        },

        /**
        * Requester pressed a button for a dispute opening
        */
        onPressRequesterOpenDispute: function () {

            this._openProblemDispute();

        },

        /**
        * Selected file extension mismatch
        */
        onFileTypeMismatch: function () {

            sap.m.MessageBox.error(this.getResourceBundle().getText("fileFormatIsNotSupported"));

            var oUploadSet = this.byId("problemUploadSet");
            oUploadSet.removeAllIncompleteItems();

        },
        /**
        * Selected file format mismatch
        */
        onMediaTypeMismatch: function () {

            sap.m.MessageBox.error(this.getResourceBundle().getText("fileFormatIsNotSupported"));

            var oUploadSet = this.byId("problemUploadSet");
            oUploadSet.removeAllIncompleteItems();

        },


        /**
        * Details are refreshed from a list
        */
        onRefreshDetailFromList: function () {

            this.byId("problemUploadSet").getBinding("items").refresh();
            this.getView().byId("textsList").getBinding("items").refresh();
            this._refreshView();

        },

        /**
        * Requester pressed save in reply mode
        */
        onPressRequesterSaveAndReply: function () {

            var t = this;

            this._validateRequestersReply(function () {

                t._executeRequesterReply();

            });
        },

        /**
        * Requester pressed exit from reply mode
        */
        onPressRequesterExitFromReplyMode: function () {

            this._deactivateEditMode();

        },

        /**
        * Requester pressed Reply button 
        */
        onPressRequesterReply: function () {
            this._activateEditMode();

        },

        /**
        * Closed problem closure commentents dialog
        */
        onCloseClosureCommentsDialog: function () {

            this._closeClosureCommentsDialog();

        },

        /**
        * Problem confirmation or withdrawal after a comments provision
        */
        onExecuteClosureAfterCommentsProvision: function () {

            this._executeProblemClosureAfterCommentsProvision();

        },

        /**
        * Requester confirmation execution
        */
        onPressRequesterConfirm: function () {

            this._confirmProblem();

        },

        /**
        * Requester withdraw execution
        */
        onPressRequesterWithdraw: function () {

            this._withdrawProblem();

        },

        /**
        * Requester update execution
        */
        onRequesterUpdateProblemExecution: function () {

            this._executeProblemRequesterUpdate();

        },

        /**
        * Requester update button pressed
        */
        onPressRequesterUpdate: function () {

            this._openProblemRequesterUpdateDialog();

        },

        /**
        * Close requester update dialog
        */
        onCloseProblemRequesterUpdateDialog: function (oEvent) {

            this.problemRequesterUpdateDialog.destroy(true);

        },

        /**
       * Upload completed
       */
        onUploadCompleted: function (oEvent) {
            var oUploadSet = this.byId("problemUploadSet");
            oUploadSet.removeAllIncompleteItems();
            oUploadSet.getBinding("items").refresh();

        },

        /**
        * Handler for a situation, when file name is pressed in UploadSet
        */
        onFileNamePress: function (oEvent) {

            this._openFileByFileName(oEvent);

        },

        /**
         * Updates the item count within the line item table's header
         * @param {object} oEvent an event containing the total number of items in the list
         * @private
         */
        onListUpdateFinished: function (oEvent) {
            var sTitle,
                iTotalItems = oEvent.getParameter("total"),
                oViewModel = this.getModel("detailView");

            // only update the counter if the length is final
            if (this.byId("lineItemsList").getBinding("items").isLengthFinal()) {
                if (iTotalItems) {
                    sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
                } else {
                    //Display 'Line Items' instead of 'Line items (0)'
                    sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
                }
                oViewModel.setProperty("/lineItemListTitle", sTitle);
            }
        },

        /* =========================================================== */
        /* begin: internal methods                                     */
        /* =========================================================== */
 
        /**
        * Get problem dispute dialog text
        */
        _getProblemDisputeDialogText: function () {

            var sProblemDisputeDialogText = this.oProblemDisputeCommentFragment.getContent()[0].getItems()[0].getContent()[0].getItems()[0].getValue();

            // Vulnerabilities clearing

            sProblemDisputeDialogText = this._clearTextFieldVulnerabilities(sProblemDisputeDialogText, this.oProblemDisputeCommentFragment.getContent()[0].getItems()[0].getContent()[0].getItems()[0].__proto__.getMetadata()._sClassName);

            return sProblemDisputeDialogText;

        },


        /*
        * Open problem dispute comment dialog     
        */
        _openProblemDisputeCommentDialog: function () {

            this._setDisputeHistory();

            this.oProblemDisputeCommentFragment = sap.ui.xmlfragment("yslpmmyprb.view.ProblemDisputeComment", this);

            this.getView().addDependent(this.oProblemDisputeCommentFragment);

            this.oProblemDisputeCommentFragment.open();

        },


        /**
        * Execute problem dispute opening
        */
        _executeProblemDisputeOpening: function () {

            var t = this;

            sharedLibrary.callFunctionImport(
                'openProblemDispute',
                t.getResourceBundle().getText("problemUpdateFailure"),
                t,
                'GET',
                { 'Guid': t.Guid },
                true,
                function (response) {

                    t._deactivateEditMode();

                    t._refreshView();

                    t.getView().byId("textsList").getBinding("items").refresh();

                    t._refreshListFromDetail(t.ObjectId);

                }
            );

        },

        /**
        * Destroy Problem Dispute Comment dialog
        */
        _destroyProblemDisputeComment: function () {

            this.oProblemDisputeCommentFragment.destroy(true);
        },

        /**
        * Destroy Dispute History dialog
        */
        _destroyDisputeHistoryDialog: function () {

            this.oDisputeHistoryFragment.destroy(true);
        },

        /**
        * Get Dispute History from backend
        */
        _setDisputeHistory: function () {

            var t = this,
                sErroneousExecutionText = this.getResourceBundle().getText("oDataModelReadFailure");

            sharedLibrary.readEntitiesAssoiciationByEdmGuidKey("Problem", this.Guid, "DisputeHistory",
                sErroneousExecutionText, this, false, false, function (oData) {

                    t.oDisputeHistory = oData.results;

                });
        },

        /*
        * Open problem dispute dialog     
        */
        _openDisputeHistoryDialog: function () {


            var t = this;

            this._setDisputeHistory();

            this.oDisputeHistoryFragment = sap.ui.xmlfragment("yslpmmyprb.view.DisputeHistory", this);

            this.getView().addDependent(this.oDisputeHistoryFragment);

            this.oDisputeHistoryFragment.open();

            var oDisputeHistory = new sap.ui.model.json.JSONModel({

                DisputeHistoryList: t.oDisputeHistory

            });

            sap.ui.getCore().byId("DisputeHistoryTable").setModel(oDisputeHistory, "DisputeHistoryModel");

        },

        /*
        * Open problem dispute     
        */
        _openProblemDispute: function () {

            var t = this,
                sText = this.getResourceBundle().getText("confirmDisputeOpening");

            sharedLibrary.confirmAction(sText, function () {

                t.problemDisputeAction = 'Open';

                t._openProblemDisputeCommentDialog();

                // sharedLibrary.callFunctionImport(
                //     'openProblemDispute',
                //     t.getResourceBundle().getText("problemUpdateFailure"),
                //     t,
                //     'GET',
                //     { 'Guid': t.Guid },
                //     true,
                //     function (response) {

                //         t._refreshApplicationAndSwitchOffEditMode();

                //     }
                // );

            });
        },


        /*
        * Set text types constants        
        */
        _setTextTypesConstants: function () {

            const textTypes = {

            };

            for (var i = 0; i < this.oFrontendConstants.oData.FrontendConstants.results.length; i++) {

                if (this.oFrontendConstants.oData.FrontendConstants.results[i].Class == 'textTypes') {

                    textTypes[this.oFrontendConstants.oData.FrontendConstants.results[i].Parameter] = this.oFrontendConstants.oData.FrontendConstants.results[i].Value;

                }

            }

            return textTypes;

        },

        /*
        * Set status names constants        
        */
        _setStatusNamesConstants: function () {

            const statusNames = {

            };

            for (var i = 0; i < this.oFrontendConstants.oData.FrontendConstants.results.length; i++) {

                if (this.oFrontendConstants.oData.FrontendConstants.results[i].Class == 'statusNames') {

                    statusNames[this.oFrontendConstants.oData.FrontendConstants.results[i].Parameter] = this.oFrontendConstants.oData.FrontendConstants.results[i].Value;

                }

            }

            return statusNames;

        },

        /*
        * Disable drag and drop function for UploadSet
        */
        _disableUploadSetDragAndDrop: function () {

            this.getView().byId("problemUploadSet").addDelegate({
                ondragenter: function (oEvent) {
                    oEvent.stopPropagation()
                },
                ondragover: function (oEvent) {
                    oEvent.stopPropagation()
                },
                ondrop: function (oEvent) {
                    oEvent.stopPropagation()
                }
            }, true);

        },

        /**
        * Vulnerabilities clearing
        */

        _clearTextFieldVulnerabilities: function (sTextField, sTextFieldClassName) {

            if ((sTextField) && (sharedLibrary.getTextFieldTypesToValidateVulnerabilities().includes(sTextFieldClassName))) {

                sTextField = sharedLibrary.clearTextFieldVulnerabilities(sTextField);

            }

            return sTextField;

        },

        /**
        * Open attachment file by name
        */
        _openFileByFileName(oEvent) {

            var attachmentPointer = oEvent.getSource().getBindingContext().sPath + "/$value",
                fullFilePathUrl = sharedLibrary.getODataPath(this) + attachmentPointer,
                fullFilePathUrlFixed = sharedLibrary.validateAndFixUrl(fullFilePathUrl), item = oEvent.getParameter("item");

            // Initial url property of item of UploadSet is set to documentId and cannot be reached from a browser
            // However, initially we still need url property set, as without it a file name will not be clickable
            // Approach: replacing url property of a UploadSet item to a proper URL of an attachment

            item.setProperty("url", fullFilePathUrlFixed);

        },


        /**
        * Execute problem closure after comments provision
        */
        _executeProblemClosureAfterCommentsProvision() {

            var t = this;

            this.problemClosurePayload.Note = this._getProblemClosureDialogText();

            this._closeClosureCommentsDialog();

            this._executeProblemClosure();

        },

        /**
        * Open requester update dialog
        */
        _openProblemRequesterUpdateDialog: function () {

            this.problemRequesterUpdateDialog = sap.ui.xmlfragment("yslpmmyprb.view.ProblemRequesterUpdate", this);

            this.getView().addDependent(this.problemRequesterUpdateDialog);

            this.problemRequesterUpdateDialog.open();
        },

        /**
        * Creation of a problem text
        */
        _createProblemText: function (sGuid, sTextId, sText, callback) {

            var oTextPayload = {};

            oTextPayload.Tdid = sTextId;
            oTextPayload.TextString = sText;

            sharedLibrary.createSubEntity("ProblemSet", sGuid, "Text", oTextPayload,
                null, this.getResourceBundle().getText("textCreationFailure"),
                this, function () { });

            callback();
        },

        /**
        * Execute requester problem update
        */
        _executeProblemRequesterUpdate: function () {

            var sText = this.getResourceBundle().getText("confirmProblemRequesterUpdate"),
                t = this;

            sharedLibrary.confirmAction(sText, function () {

                var oPayload = {};
                oPayload.Status = t.Status;


                sharedLibrary.updateEntityByEdmGuidKey(t.Guid, oPayload, "ProblemSet",
                    t.getResourceBundle().getText("problemUpdatedSuccessfully", t.ObjectId), t.getResourceBundle().getText("problemUpdateFailure"), null,
                    t, function () {

                        t._createProblemText(t.Guid, t.textTypes.additionalInformation, t._getProblemRequesterUpdateDialogText(),
                            function () {

                                t.onCloseProblemRequesterUpdateDialog();
                                t._refreshView();
                                t.getView().byId("textsList").getBinding("items").refresh();

                            });
                    });

            });

        },

        /**
        * Upload all incomplete problem attachments at once in a cycle
        */

        _uploadProblemAttachments: function (sGuid, callback) {

            var oUploadSet = this.byId("problemUploadSet"),
                sAttachmentUploadURL = "/ProblemSet(guid'" + sGuid + "')/Attachment",
                oItems = oUploadSet.getIncompleteItems();

            oUploadSet.setUploadUrl(sharedLibrary.getODataPath(this) + sAttachmentUploadURL);

            for (var k = 0; k < oItems.length; k++) {

                var oItem = oItems[k];
                var sFileName = oItem.getFileName();

                var oCustomerHeaderToken = new sap.ui.core.Item({
                    key: "x-csrf-token",
                    text: this.getModel().getSecurityToken()
                });

                // Header slug to store a file name
                var oCustomerHeaderSlug = new sap.ui.core.Item({
                    key: "slug",
                    text: encodeURIComponent(sFileName)
                });

                oUploadSet.addHeaderField(oCustomerHeaderToken);
                oUploadSet.addHeaderField(oCustomerHeaderSlug);
                oUploadSet.uploadItem(oItem);
                oUploadSet.removeAllHeaderFields();
            }

            callback();
        },

        /**
        * Get Requester's reply text
        */
        _getRequesterReplyText: function () {

            var sReplyText = this.byId("communicationTabTextInputArea").getValue();

            // Vulnerabilities clearing

            sReplyText = this._clearTextFieldVulnerabilities(sReplyText, this.byId("communicationTabTextInputArea").__proto__.getMetadata()._sClassName);

            return sReplyText;
        },

        /**
        * Validate Requester's reply
        */
        _validateRequestersReply: function (callback) {

            var sRequesterReplyText = this._getRequesterReplyText();

            // Mandatory reply text is not provided

            if (!sRequesterReplyText) {

                var sErrorMessage = this.getResourceBundle().getText("mandatoryReplyTextNotEntered");

                sharedLibrary.setFieldErrorState(this, 'communicationTabTextInputArea');

                sap.m.MessageBox.error(sErrorMessage);

            } else {

                sharedLibrary.dropFieldState(this, 'communicationTabTextInputArea');

                callback();
            }
        },

        /**
        * Get status code
        */
        _getStatusCode: function (sStatusName) {

            var t = this;

            for (var key in this.statusNames) {

                if (sStatusName == key) {

                    return t.statusNames[key];

                }
            }
        },

        /**
        * Update problem with a Requester's reply
        */
        _executeRequesterReply: function () {

            var sText = this.getResourceBundle().getText("confirmRequesterReply"),
                t = this,
                oPayload = {};

            sharedLibrary.confirmAction(sText, function () {

                switch (t.Status) {
                    case t._getStatusCode("customerAction"):

                        oPayload.Status = t.statusNames.inProcess;
                        break;


                    case t._getStatusCode("solutionProvided"):

                        oPayload.Status = t.statusNames.inProcess;
                        break;


                    case t._getStatusCode("informationRequested"):

                        oPayload.Status = t.statusNames.onApproval;
                        break;

                }

                oPayload.Note = t._getRequesterReplyText();

                sharedLibrary.updateEntityByEdmGuidKey(t.Guid, oPayload, "ProblemSet",
                    null, t.getResourceBundle().getText("problemUpdateFailure"), null,
                    t, function () {

                        t._uploadProblemAttachments(t.Guid, function () {

                            sap.m.MessageBox.information(t.getResourceBundle().getText("problemUpdatedSuccessfully", t.ObjectId));

                            t.byId("problemUploadSet").getBinding("items").refresh();

                            t._deactivateEditMode();

                            t._refreshView();

                            t.getView().byId("textsList").getBinding("items").refresh();

                            t._refreshListFromDetail(t.ObjectId);


                        });

                    });
            });

        },

        /**
        * Deactivated edit mode
        */
        _deactivateEditMode: function () {

            var oRuntimeModel = this.getOwnerComponent().getModel("runtimeModel");
            oRuntimeModel.setProperty("/editModeActive", false);

            this.byId("communicationTabTextInputArea").setValue("");
        },

        /**
        * Get tabs full Id by Id mask
        */
        _getFullTabIdByIdMask: function (sIdMask) {

            var oIconTabBarItems = this.byId("iconTabBar").getItems();

            for (var i = 0; i < oIconTabBarItems.length; i++) {

                if (oIconTabBarItems[i].sId.indexOf(sIdMask) > 0) {

                    return oIconTabBarItems[i].sId;

                }
            }

        },


        /**
        * Activate edit mode
        */
        _activateEditMode: function () {

            var oRuntimeModel = this.getOwnerComponent().getModel("runtimeModel");
            oRuntimeModel.setProperty("/editModeActive", true);

            // Switching to communication tab

            var sTabCommunicationFullName = this._getFullTabIdByIdMask("tabCommunication");

            this.byId("iconTabBar").setSelectedKey(sTabCommunicationFullName);
        },

        /**
        * Close closure comments dialog
        */
        _closeClosureCommentsDialog: function () {

            this.closureCommentsDialog.destroy(true);

        }
        ,

        /**
        * Show closure comments dialog
        */
        _openClosureCommentsDialog: function () {

            this.closureCommentsDialog = sap.ui.xmlfragment("yslpmmyprb.view.ClosureComments", this);

            this.getView().addDependent(this.closureCommentsDialog);

            this.closureCommentsDialog.open();

        },

        /**
        * Refresh whole view
        */
        _refreshView: function () {

            this.getView().getElementBinding().refresh(true);
        },

        /**
        * Close problem through OData call
        */
        _executeProblemClosure: function () {

            var t = this;

            sharedLibrary.updateEntityByEdmGuidKey(this.Guid, this.problemClosurePayload, "ProblemSet",
                this.getResourceBundle().getText("problemClosedSuccessfully", t.ObjectId),
                this.getResourceBundle().getText("problemClosureFailure"), null,
                this, function () {

                    t.getView().byId("textsList").getBinding("items").refresh();
                    t._refreshView();
                    t._refreshListFromDetail(t.ObjectId);

                });

        },

        /**
        * Confirm problem
        */
        _confirmProblem: function () {

            var sText = this.getResourceBundle().getText("confirmProblemConfirmation"),
                t = this;

            sharedLibrary.confirmAction(sText, function () {

                t.problemClosurePayload.Status = t.statusNames.confirmed;

                // Check if additional comments should be added

                var sClosureCommentsProposal = t.getResourceBundle().getText("confirmAddingOfClosureComments");

                sharedLibrary.confirmActionOnOkAndCancel(sClosureCommentsProposal, function (sSelectedOption) {

                    switch (sSelectedOption) {
                        case 'OK':
                            t._openClosureCommentsDialog();
                            break;
                        case 'CANCEL':
                            t._executeProblemClosure();
                            break;
                    }
                });
            });
        },

        /**
        * Refresh list from detail form
        */
        _refreshListFromDetail: function (sObjectId) {

            // Bus specification:
            // 1. ChannelName, 2. EventName, 3. the data

            this.oEventBus.publish("DetailAction", "onRefreshListFromDetail", {
                ObjectId: sObjectId
            });
        },

        /**
        * Withdraw problem
        */
        _withdrawProblem: function () {

            var sText = this.getResourceBundle().getText("confirmProblemWithdrawal"),
                t = this;

            sharedLibrary.confirmAction(sText, function () {

                t.problemClosurePayload.Status = t.statusNames.withdrawn;

                // Check if additional comments should be added

                var sClosureCommentsProposal = t.getResourceBundle().getText("confirmAddingOfClosureComments");

                sharedLibrary.confirmActionOnOkAndCancel(sClosureCommentsProposal, function (sSelectedOption) {

                    switch (sSelectedOption) {
                        case 'OK':
                            t._openClosureCommentsDialog();
                            break;
                        case 'CANCEL':
                            t._executeProblemClosure();
                            break;
                    }
                });
            });



        },


        /**
        * Get problem closure dialog text
        */
        _getProblemClosureDialogText: function () {

            var sClosureDialogText = this.closureCommentsDialog.getContent()[0].getItems()[0].getContent()[0].getItems()[0].getValue();

            // Vulnerabilities clearing

            sClosureDialogText = this._clearTextFieldVulnerabilities(sClosureDialogText, this.closureCommentsDialog.getContent()[0].getItems()[0].getContent()[0].getItems()[0].__proto__.getMetadata()._sClassName);

            return sClosureDialogText;

        },


        /**
        * Get problem requestor update dialog text
        */

        _getProblemRequesterUpdateDialogText: function () {

            var sUpdateDialogText = this.problemRequesterUpdateDialog.getContent()[0].getItems()[0].getContent()[0].getItems()[0].getValue();

            // Vulnerabilities clearing

            sUpdateDialogText = this._clearTextFieldVulnerabilities(sUpdateDialogText, this.problemRequesterUpdateDialog.getContent()[0].getItems()[0].getContent()[0].getItems()[0].__proto__.getMetadata()._sClassName);

            return sUpdateDialogText;

        },

        /**
        * Refresh UploadSet
        */

        _refreshUploadSet: function () {

            var oUploadSet = this.byId("problemUploadSet");
            oUploadSet.getBinding("items").refresh();

        },


        /**
        * Returns ProblemSet URL pointer to a particular Guid
        */

        _getProblemGuidPointer: function () {

            return "/ProblemSet(guid'" + this.Guid + "')";
        },


        /**
        * Initiates upload of new files in UploadSet 
        */
        _startUpload: function () {
            var oUploadSet = this.byId("problemUploadSet");
            var cFiles = oUploadSet.getIncompleteItems().length;

            if (cFiles > 0) {
                oUploadSet.upload();
            }
        },

        /**
         * Binds the view to the object path and expands the aggregated line items.
         * @function
         * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
         * @private
         */
        _onObjectMatched: function (oEvent) {
            var sObjectId = oEvent.getParameter("arguments").objectId;
            this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
            this.getModel().metadataLoaded().then(function () {
                var sObjectPath = this.getModel().createKey("ProblemSet", {
                    Guid: sObjectId
                });
                this._bindView("/" + sObjectPath);
            }.bind(this));
        },

        /**
         * Binds the view to the object path. Makes sure that detail view displays
         * a busy indicator while data for the corresponding element binding is loaded.
         * @function
         * @param {string} sObjectPath path to the object to be bound to the view.
         * @private
         */
        _bindView: function (sObjectPath) {
            // Set busy indicator during view binding
            var oViewModel = this.getModel("detailView");

            // If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
            oViewModel.setProperty("/busy", false);

            this.getView().bindElement({
                path: sObjectPath,
                events: {
                    change: this._onBindingChange.bind(this),
                    dataRequested: function () {
                        oViewModel.setProperty("/busy", true);
                    },
                    dataReceived: function () {
                        oViewModel.setProperty("/busy", false);
                    }
                }
            });
        },

        _onBindingChange: function () {




            var oView = this.getView(),
                oElementBinding = oView.getElementBinding();

            // No data for the binding
            if (!oElementBinding.getBoundContext()) {
                this.getRouter().getTargets().display("detailObjectNotFound");
                // if object could not be found, the selection in the list
                // does not make sense anymore.
                this.getOwnerComponent().oListSelector.clearListListSelection();
                return;
            }

            var sPath = oElementBinding.getPath(),
                oResourceBundle = this.getResourceBundle(),
                oObject = oView.getModel().getObject(sPath),
                sObjectGuid = oObject.Guid,
                sObjectId = oObject.ObjectId,
                oViewModel = this.getModel("detailView");


            this.Guid = sObjectGuid;
            this.ObjectId = sObjectId;
            this.Status = oObject.Status;
            this.SAPSystemName = oObject.SAPSystemName;

            this.getOwnerComponent().oListSelector.selectAListItem(sPath);

            this._deactivateEditMode();

        },

        _onMetadataLoaded: function () {
            // Store original busy indicator delay for the detail view
            var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
                oViewModel = this.getModel("detailView"),
                oLineItemTable = this.byId("lineItemsList"),
                iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

            // Make sure busy indicator is displayed immediately when
            // detail view is displayed for the first time
            oViewModel.setProperty("/delay", 0);
            oViewModel.setProperty("/lineItemTableDelay", 0);

            oLineItemTable.attachEventOnce("updateFinished", function () {
                // Restore original busy indicator delay for line item table
                oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
            });

            // Binding the view will set it to not busy - so the view is always busy if it is not bound
            oViewModel.setProperty("/busy", true);
            // Restore original busy indicator delay for the detail view
            oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
        },

        /**
         * Set the full screen mode to false and navigate to list page
         */
        onCloseDetailPress: function () {
            this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", false);
            // No item should be selected on list after detail page is closed
            this.getOwnerComponent().oListSelector.clearListListSelection();
            this.getRouter().navTo("list");
        },

        /**
         * Toggle between full and non full screen mode.
         */
        toggleFullScreen: function () {
            var bFullScreen = this.getModel("appView").getProperty("/actionButtonsInfo/midColumn/fullScreen");
            this.getModel("appView").setProperty("/actionButtonsInfo/midColumn/fullScreen", !bFullScreen);
            if (!bFullScreen) {
                // store current layout and go full screen
                this.getModel("appView").setProperty("/previousLayout", this.getModel("appView").getProperty("/layout"));
                this.getModel("appView").setProperty("/layout", "MidColumnFullScreen");
            } else {
                // reset to previous layout
                this.getModel("appView").setProperty("/layout", this.getModel("appView").getProperty("/previousLayout"));
            }
        }
    });

});