// Constants classes

const textTypes = Object.freeze(
    class textTypes {
        static reply = 'SU01';
        static description = 'SU99';
        static reproductionSteps = 'SURS';
        static internalNote = 'SU04';
        static solution = 'SUSO';
        static businessConsequences = 'SUBI';
    });

    const statusNames = Object.freeze(
        class statusNames {
            static new = 'E0001'
            static approved = 'E0015';
            static inProcess = 'E0002';
            static customerAction = 'E0003';
            static solutionProvided = 'E0005';
            static confirmed = 'E0008';
            static withdrawn = 'E0010';
        });
    

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

    return BaseController.extend("zslpmmyprb.controller.Detail", {

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

        },

        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */

        /**
        * Details are refreshed from a list
        */      
        onRefreshDetailFromList: function () {

            this.byId("UploadSet").getBinding("items").refresh();
            this.getView().byId("textsList").getBinding("items").refresh();

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
            var oUploadSet = this.byId("UploadSet");
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

            this.problemRequesterUpdateDialog = sap.ui.xmlfragment("zslpmmyprb.view.ProblemRequesterUpdate", this);

            this.getView().addDependent(this.problemRequesterUpdateDialog);

            this.problemRequesterUpdateDialog.open();
        },

        /**
        * Execute requester problem update
        */

        _executeProblemRequesterUpdate: function () {

            var sText = this.getResourceBundle().getText("confirmProblemRequesterUpdate"),
                t = this;

            sharedLibrary.confirmAction(sText, function () {

                var oPayload = {};
                oPayload.Note = t._getProblemRequesterUpdateDialogText();

                sharedLibrary.updateEntityByEdmGuidKey(t.Guid, oPayload, "ProblemSet",
                    t.getResourceBundle().getText("problemUpdatedSuccessfully", t.ObjectId), t.getResourceBundle().getText("problemUpdateFailure"), null,
                    t, function () {

                        t.onCloseProblemRequesterUpdateDialog();
                        t.getView().byId("textsList").getBinding("items").refresh();

                    });
            });

        },

        /**
        * Upload all incomplete problem attachments at once in a cycle
        */

        _uploadProblemAttachments: function (sGuid, callback) {

            var oUploadSet = this.byId("UploadSet"),
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
                    text: sFileName
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

            return this.byId("communicationTabTextInputArea").getValue();
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
        * Update problem with a Requester's reply
        */
        _executeRequesterReply: function () {

            var sText = this.getResourceBundle().getText("confirmRequesterReply"),
                t = this,
                oPayload = {};

            sharedLibrary.confirmAction(sText, function () {

                oPayload.Status = statusNames.inProcess;
                oPayload.Note = t._getRequesterReplyText();

                sharedLibrary.updateEntityByEdmGuidKey(t.Guid, oPayload, "ProblemSet",
                    null, t.getResourceBundle().getText("problemUpdateFailure"), null,
                    t, function () {

                        t._uploadProblemAttachments(t.Guid, function () {

                            sap.m.MessageBox.information(t.getResourceBundle().getText("problemUpdatedSuccessfully", t.ObjectId));

                            t.byId("UploadSet").getBinding("items").refresh();

                            t._deactivateEditMode();
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
        },
        /**
        * Activate edit mode
        */
        _activateEditMode: function () {

            var oRuntimeModel = this.getOwnerComponent().getModel("runtimeModel");
            oRuntimeModel.setProperty("/editModeActive", true);
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

            this.closureCommentsDialog = sap.ui.xmlfragment("zslpmmyprb.view.ClosureComments", this);

            this.getView().addDependent(this.closureCommentsDialog);

            this.closureCommentsDialog.open();

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

                t.problemClosurePayload.Status = statusNames.confirmed;

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

                t.problemClosurePayload.Status = statusNames.withdrawn;

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


            // var sText = this.getResourceBundle().getText("confirmProblemWithdrawal"),
            //     t = this;

            // sharedLibrary.confirmAction(sText, function () {

            //     var oPayload = {};
            //     oPayload.Status = statusNames.withdrawn;

            //     sharedLibrary.updateEntityByEdmGuidKey(t.Guid, oPayload, "ProblemSet",
            //         t.getResourceBundle().getText("problemWithdrawnSuccessfully", t.ObjectId),
            //         t.getResourceBundle().getText("problemWithdrawalFailure"), null,
            //         t, function () {

            //             t._refreshListFromDetail(t.ObjectId);

            //         });
            // });

        },

        /**
        * Get problem closure dialog text
        */
        _getProblemClosureDialogText: function () {

            return this.closureCommentsDialog.getContent()[0].getItems()[0].getContent()[0].getItems()[0].getValue();

        },


        /**
        * Get problem requestor update dialog text
        */

        _getProblemRequesterUpdateDialogText: function () {

            return this.problemRequesterUpdateDialog.getContent()[0].getItems()[0].getContent()[0].getItems()[0].getValue();

        },

        /**
        * Refresh UploadSet
        */

        _refreshUploadSet: function () {

            var oUploadSet = this.byId("UploadSet");
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
            var oUploadSet = this.byId("UploadSet");
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

            this.getOwnerComponent().oListSelector.selectAListItem(sPath);

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