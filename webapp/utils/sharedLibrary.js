sap.ui.define([], function () {
    "use strict";
    return {


        /**
        * Create OData entity
        */

        createEntity: function (sEntityName, oPayload,
            sSuccessfullExecutionText, sErroneousExecutionText,
            oView, callback) {

            var sODataPath = this.getODataPath(oView),
                oModel = new sap.ui.model.odata.ODataModel(sODataPath, true),
                sEntityPointer = "/" + sEntityName + "Set";

            oModel.create(sEntityPointer, oPayload, {
                success: function (oData) {

                    if (sSuccessfullExecutionText && sSuccessfullExecutionText.length > 0) {

                        sap.m.MessageBox.information(sSuccessfullExecutionText);
                    }

                    callback(oData);

                },
                error: function (oError) {

                    var oMessage = sErroneousExecutionText + ':\n' +
                        JSON.parse(oError.response.body).error.message.value;

                    sap.m.MessageBox.error(oMessage);
                }
            });
        },


        /**
        * Create OData sub-Entity of Entity by Edm.Guid key or Entity
        */

        createSubEntity: function (sEntityName, sEntityGuid, sSubEntityName, oPayload, 
            sSuccessfullExecutionText, sErroneousExecutionText,
            oView, callback) {

            var sODataPath = this.getODataPath(oView),
                oModel = new sap.ui.model.odata.ODataModel(sODataPath, true),
                sSubEntityPointer = "/" + sEntityName + "(guid'" + sEntityGuid + "')/" + sSubEntityName;
     
           
                oModel.create(sSubEntityPointer, oPayload, {
                success: function (oData) {

                    if (sSuccessfullExecutionText && sSuccessfullExecutionText.length > 0) {

                        sap.m.MessageBox.information(sSuccessfullExecutionText);
                    }

                    callback(oData);

                },
                error: function (oError) {

                    var oMessage = sErroneousExecutionText + ':\n' +
                        JSON.parse(oError.response.body).error.message.value;

                    sap.m.MessageBox.error(oMessage);
                }
            });
        },




        /**
        * Update OData entity by Edm.Guid entity key
        */

        updateEntityByEdmGuidKey: function (sGuid, oPayload, sEntityName,
            sSuccessfullExecutionText, sErroneousExecutionText, oUrlParameters,
            oView, callback) {

            var sODataPath = this.getODataPath(oView),
                oModel = new sap.ui.model.odata.ODataModel(sODataPath, true)
            sEntityEdmGuidPointer = "/" + sEntityName + "(guid'" + sGuid + "')";

            oModel.update(sEntityEdmGuidPointer, oPayload, {
                oUrlParameters,
                success: function () {

                    sap.m.MessageBox.information(sSuccessfullExecutionText);

                    callback();

                },
                error: function (oError) {

                    var oMessage = sErroneousExecutionText + ':\n' +
                        JSON.parse(oError.response.body).error.message.value;

                    sap.m.MessageBox.error(oMessage);
                }
            });
        },

        /**
        * Convert string date to EPOCH format
        */

        convertStringDateToEpoch: function (stringDate) {

            var dateParts = stringDate.split(".");

            // Month is 0-based, that's why we need dataParts[1] - 1

            var dateObject = new Date(Date.UTC(+dateParts[2], dateParts[1] - 1, +dateParts[0]));

            return dateObject;

        },

        /**
        * Set field error state
        */

        setFieldErrorState: function (oView, sFieldId) {

            oView.byId(sFieldId).setValueState("Error");

        }, // setFieldErrorState: function (sFieldId)

        /**
        * Drop field state
        */

        dropFieldState: function (oView, sFieldId) {

            oView.byId(sFieldId).setValueState("None");

        }, // dropFieldState: function (sFieldId)

        /**
        * Returns OData service path
        */

        getODataPath: function (oView) {

            return oView.getOwnerComponent().getManifestEntry("/sap.app/dataSources/mainService/uri");
        },

        /**
        * Confirmation message box with callback
        */

        confirmAction: function (sText, callback) {

            sap.m.MessageBox.confirm(sText, {
                actions: [
                    sap.m.MessageBox.Action.OK,
                    sap.m.MessageBox.Action.CANCEL
                ],
                onClose: function (s) {
                    if (s === "OK") {
                        return callback();
                    }
                }
            });
        },

        /**
        * Information message box with callback
        */

        informationAction: function (sText, callback) {

            sap.m.MessageBox.information(sText, {
                actions: [
                    sap.m.MessageBox.Action.OK,
                ],
                onClose: function (s) {
                    if (s === "OK") {
                        return callback();
                    }
                }
            });
        },

        /**
        * Validate and fix URL
        */
        validateAndFixUrl: function (sUrlRaw) {

            var sUrlFixed;

            // Remove double slash
            sUrlFixed = sUrlRaw.replace("//", "/");

            return sUrlFixed;

        },

    };
});