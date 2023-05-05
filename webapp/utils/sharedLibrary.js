const textFieldTypesToValidateVulnerabilities = Object.freeze(
    class textFieldTypesToValidateVulnerabilities {
        static fieldTypes = ['sap.m.TextArea', 'sap.m.Input'];
    });


sap.ui.define([
    "sap/ui/export/library",
    "sap/ui/export/Spreadsheet"
], function (exportLibrary, spreadsheet) {
    "use strict";
    return {

        /**
        * Get text field types to validate vulnerabilities        
        */

        getTextFieldTypesToValidateVulnerabilities: function() {

            return textFieldTypesToValidateVulnerabilities.fieldTypes;

        },

        /**
        * Validation for Vulnerabilities: text fields
        */

        clearTextFieldVulnerabilities: function (sTextFieldData) {

            var sTextFieldDataWithoutVulnerabilities;

            // Remove JS script tags

            var jsOpenRegex = /<script[^>]*>/g,
                jsCloseRegex = /<\/script>/g;

            sTextFieldDataWithoutVulnerabilities = sTextFieldData.replace(jsOpenRegex, '-script-open-tag-').replace(jsCloseRegex, '-script-close-tag-');

            return sTextFieldDataWithoutVulnerabilities;

        },

        /**
        * Validation of email
        */
        isValidEmailAddress: function (sEmailAddress) {

            var t = this,
                sMailregex = /^\w+[\w-+\.]*\@\w+([-\.]\w+)*\.[a-zA-Z]{2,}$/;

            if (sMailregex.test(sEmailAddress)) {

                return true;

            }
        },

        /**
        * Check if objects are equal
        */
        areObjectsEqual: function (oObject1, oObject2) {
            const oKeys1 = Object.keys(oObject1),
                oKeys2 = Object.keys(oObject2);

            if (oKeys1.length !== oKeys2.length) {
                return false;
            }
            for (let key of oKeys1) {
                if (oObject1[key] !== oObject2[key]) {
                    return false;
                }
            }
            return true;
        },

        /**
        * Read OData entities association by entities Edm.Guid Key
        */
        readEntitiesAssoiciationByEdmGuidKey: function (sEntityName, sEntityGuid, sAssociationName,
            sErroneousExecutionText, oView, bAsync, bShowErrorMessage, callback) {

            var sODataPath = this.getODataPath(oView),
                oModel = new sap.ui.model.odata.ODataModel(sODataPath, true),
                sEntityPointer = "/" + sEntityName + "Set(guid'" + sEntityGuid + "')/" + sAssociationName;

            oModel.read(sEntityPointer, {
                async: bAsync,
                success: function (oData) {

                    callback(oData);

                },
                error: function (oError) {

                    var sMessage;

                    if (oError.response) {
                        sMessage = JSON.parse(oError.response.body).error.message.value;
                    }

                    if (sErroneousExecutionText) {
                        sMessage = sErroneousExecutionText + ':\n' + sMessage;
                    }

                    if (bShowErrorMessage) {
                        sap.m.MessageBox.error(sMessage);
                    } else {
                        callback(sMessage);
                    }
                }
            });
        },


        /**
        * Read OData entity with set filter
        */
        readEntityWithFilter: function (sEntityName, sFilterExpression, sErroneousExecutionText, oView, bAsync, bShowErrorMessage, callback) {

            var sODataPath = this.getODataPath(oView),
                oModel = new sap.ui.model.odata.ODataModel(sODataPath, true),
                sEntityPointer = "/" + sEntityName + "Set";

            if (sFilterExpression.length > 0) {

                sEntityPointer = sEntityPointer + "?$filter=" + sFilterExpression;

            }

            oModel.read(sEntityPointer, {
                async: bAsync,
                success: function (oData) {

                    callback(oData);

                },
                error: function (oError) {

                    var sMessage;

                    if (oError.response) {
                        sMessage = JSON.parse(oError.response.body).error.message.value;
                    }

                    if (sErroneousExecutionText) {
                        sMessage = sErroneousExecutionText + ':\n' + sMessage;
                    }

                    if (bShowErrorMessage) {
                        sap.m.MessageBox.error(sMessage);
                    } else {
                        callback(sMessage);
                    }
                }
            });
        },


        /**
        * Read OData entity
        */
        readEntity: function (sEntityName, sErroneousExecutionText, oView, bAsync, bShowErrorMessage, callback) {

            var sODataPath = this.getODataPath(oView),
                oModel = new sap.ui.model.odata.ODataModel(sODataPath, true),
                sEntityPointer = "/" + sEntityName + "Set";

            oModel.read(sEntityPointer, {
                async: bAsync,
                success: function (oData) {

                    callback(oData);

                },
                error: function (oError) {

                    var sMessage;

                    if (oError.response) {
                        sMessage = JSON.parse(oError.response.body).error.message.value;
                    }

                    if (sErroneousExecutionText) {
                        sMessage = sErroneousExecutionText + ':\n' + sMessage;
                    }

                    if (bShowErrorMessage) {
                        sap.m.MessageBox.error(sMessage);
                    } else {
                        callback(sMessage);
                    }
                }
            });
        },

        /**
        * Export table to Excel
        */
        exportTableToExcel: function (oTable, sServiceUrl, sFileName) {

            var aCols = this.createAllColumnsConfigFromTable(oTable),
                oRowBinding = oTable.getBinding('items'),
                oModel = oRowBinding.getModel(),
                oSettings, oSheet;

            oSettings = {
                workbook: {
                    columns: aCols,
                    hierarchyLevel: 'Level'
                },
                dataSource: {
                    type: 'odata',
                    dataUrl: oRowBinding.getDownloadUrl ? oRowBinding.getDownloadUrl() : null,
                    serviceUrl: sServiceUrl,
                    headers: oModel.getHeaders ? oModel.getHeaders() : null,
                    count: oRowBinding.getLength ? oRowBinding.getLength() : null,
                    useBatch: true // Default for ODataModel V2
                },
                fileName: sFileName,
                worker: false // We need to disable worker because we are using a MockServer as OData Service
            };

            oSheet = new spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy();
            });
        },

        /**
        * Create all table columns configuration for table
        */
        createAllColumnsConfigFromTable: function (oTable) {

            var aCols = [],
                EdmType = exportLibrary.EdmType,
                oColumns = oTable.getColumns(),
                oTableTemplate = oTable.getBindingInfo('items').template;

            for (var k = 0; k < oColumns.length; k++) {

                var oColumn = oColumns[k];

                aCols.push({
                    property: oTableTemplate.getCells()[k].getBindingInfo('text').parts[0].path,
                    label: oColumn.getHeader().getText(),
                    type: EdmType.String
                });
            }

            return aCols;
        },

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
        updateEntityByEdmGuidKey: function (sGuid, oPayload, sEntitySetName,
            sSuccessfullExecutionText, sErroneousExecutionText, oUrlParameters,
            oView, callback) {

            var sODataPath = this.getODataPath(oView),
                oModel = new sap.ui.model.odata.ODataModel(sODataPath, true),
                sEntityEdmGuidPointer = "/" + sEntitySetName + "(guid'" + sGuid + "')";

            oModel.update(sEntityEdmGuidPointer, oPayload, {
                oUrlParameters,
                success: function () {

                    if (sSuccessfullExecutionText && sSuccessfullExecutionText.length > 0) {

                        sap.m.MessageBox.information(sSuccessfullExecutionText);

                    }

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
        * Confirmation message box with callback on OK selection
        */
        confirmAction: function (sText, callback) {

            sap.m.MessageBox.confirm(sText, {
                actions: [
                    sap.m.MessageBox.Action.OK,
                    sap.m.MessageBox.Action.CANCEL
                ],
                onClose: function (s) {
                    if (s === "OK") {
                        return callback(s);
                    }
                }
            });
        },

        /**
        * Confirmation message box with callback on OK and CANCEL selections
        */
        confirmActionOnOkAndCancel: function (sText, callback) {

            sap.m.MessageBox.confirm(sText, {
                actions: [
                    sap.m.MessageBox.Action.OK,
                    sap.m.MessageBox.Action.CANCEL
                ],
                onClose: function (s) {

                    return callback(s);

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