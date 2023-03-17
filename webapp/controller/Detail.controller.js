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


        },

        /**
        * Upload all incomplete problem attachments at once in a cycle
        */

                uploadProblemAttachments: function (sGuid, callback) {

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


        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */

        /**
        * Handler for a situation, when a comment posting button is pressed
        */
        onPressPostText: function (oEvent) {

            // Getting text of a comment

            var commentText = this.byId('replyTextInput').getValue();
    
            var oTextPayload = {},
                t = this;

            // Executing post method for Text entity

            if (commentText.length > 0) {

                oTextPayload.Tdid = textTypes.reply;
                oTextPayload.TextString = commentText;

                sharedLibrary.createSubEntity("ProblemSet", this.Guid, "Text", oTextPayload,
                null, this.getResourceBundle().getText("textCreationFailure"),
                this, function () {

                    t.getView().byId("textsList").getBinding("items").refresh();

                });
            }
        },

        /**
        * Handler for a situation, when a Delete button is pressed against a file in UploadSet
        */

        onAttachmentRemovalPress: function (oEvent) {

            // Preventing default action to display warning

            oEvent.preventDefault();

            var sAttachmentURL = oEvent.getSource().getBindingContext().sPath,
                t = this;

            // var oUploadSet = t.byId("UploadSet"),
            //     oItemToDelete = oEvent.getParameter("item");
            // oUploadSet.removeItem(oItemToDelete);

            var sText = this.getResourceBundle().getText("confirmDeletionOfAttachment");

            sharedLibrary.confirmAction(sText, function () {

                t._deleteAttachment(sAttachmentURL, function () {

                    t._refreshUploadSet();

                    var sAttachmentDeletedMessage = t.getResourceBundle().getText("attachmentDeleted");
                    sap.m.MessageBox.information(sAttachmentDeletedMessage);

                });
            });
        },

        /**
        * Handler for a situation, when a new file is added to UploadSet
        */

        onAfterItemAdded: function (oEvent) {

            this._startUpload();

        },

        /**
        * Handler for a situation, when a new file is added to UploadSet but before upload starts
        */
        onBeforeUploadStarts: function (oEvent) {

            this.byId("UploadSet").setUploadUrl(sharedLibrary.getODataPath(this) +
                this._getProblemGuidPointer() + "/Attachment");

            var oUploadSet = oEvent.getSource();
            var oItemToUpload = oEvent.getParameter("item");
            var oCustomerHeaderToken = new sap.ui.core.Item({
                key: "x-csrf-token",
                text: this.getModel().getSecurityToken()
            });

            // Header slug to store a file name
            var oCustomerHeaderSlug = new sap.ui.core.Item({
                key: "slug",
                text: oItemToUpload.getFileName()
            });

            oUploadSet.removeAllHeaderFields();
            oUploadSet.addHeaderField(oCustomerHeaderToken);
            oUploadSet.addHeaderField(oCustomerHeaderSlug);
        },

        /**
        * Handler for a situation, when an upload of a new file is completed
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

            var attachmentPointer = oEvent.getSource().getBindingContext().sPath + "/$value",
                fullFilePathUrl = sharedLibrary.getODataPath(this) + attachmentPointer,
                fullFilePathUrlFixed = sharedLibrary.validateAndFixUrl(fullFilePathUrl), item = oEvent.getParameter("item");

            // Initial url property of item of UploadSet is set to documentId and cannot be reached from a browser
            // However, initially we still need url property set, as without it a file name will not be clickable
            // Approach: replacing url property of a UploadSet item to a proper URL of an attachment

            item.setProperty("url", fullFilePathUrlFixed);
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
        * Executes a DELETE method against a Attachment entity
        */

        _deleteAttachment: function (sAttachmentURL, callback) {

            var
                oDataPath = sharedLibrary.getODataPath(this),
                oModel = new sap.ui.model.odata.ODataModel(oDataPath, true),
                oPayload = {},
                t = this;

            oModel.remove(sAttachmentURL, {

                success: function (oData, response) {

                    // Success
                    return callback();

                },
                error: function (oError) {

                    var oMessage = JSON.parse(oError.response.body).error.message.value;
                    sap.m.MessageBox.error(oMessage);

                }
            });
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
                sObjectId = oObject.Guid,
                sObjectName = oObject.ObjectId,
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