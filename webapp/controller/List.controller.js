sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/Sorter",
    "sap/ui/model/FilterOperator",
    "sap/m/GroupHeaderListItem",
    "sap/ui/Device",
    "sap/ui/core/Fragment",
    "../model/formatter"
], function (BaseController, JSONModel, Filter, Sorter, FilterOperator, GroupHeaderListItem, Device, Fragment, formatter) {
    "use strict";

    return BaseController.extend("yslpmmyprb.controller.List", {

        formatter: formatter,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        /**
         * Called when the list controller is instantiated. It sets up the event handling for the list/detail communication and other lifecycle tasks.
         * @public
         */
        onInit: function () {
            // Control state model
            var oList = this.byId("list"),
                oViewModel = this._createViewModel(),
                // Put down list's original value for busy indicator delay,
                // so it can be restored later on. Busy handling on the list is
                // taken care of by the list itself.
                iOriginalBusyDelay = oList.getBusyIndicatorDelay(),
                t = this;

            this._oList = oList;
            // keeps the filter and search state
            this._oListFilterState = {
                aFilter: [],
                aSearch: []
            };

            this.setModel(oViewModel, "listView");
            // Make sure, busy indication is showing immediately so there is no
            // break after the busy indication for loading the view's meta data is
            // ended (see promise 'oWhenMetadataIsLoaded' in AppController)
            oList.attachEventOnce("updateFinished", function () {
                // Restore original busy indicator delay for the list
                oViewModel.setProperty("/delay", iOriginalBusyDelay);
            });

            this.getView().addEventDelegate({
                onBeforeFirstShow: function () {
                    this.getOwnerComponent().oListSelector.setBoundMasterList(oList);
                }.bind(this)
            });

            this.getRouter().getRoute("list").attachPatternMatched(this._onMasterMatched, this);
            this.getRouter().attachBypassed(this.onBypassed, this);

            this.oEventBus = sap.ui.getCore().getEventBus();
            // 1. ChannelName, 2. EventName, 3. Function to be executed, 4. Listener
            this.oEventBus.subscribe("DetailAction", "onRefreshListFromDetail", this.onRefreshListFromDetail, this);


        },

        /* =========================================================== */
        /* event handlers                                              */
        /* =========================================================== */

        /**
         * Refresh button has been pressed
        */
        onPressRefreshButton: function () {

            this.onRefresh();
            return;

        },

        /**
         * Before form is rendered
        */
        onBeforeRendering: function () {

            // Set frontend constants

            this._setFrontendConstants();

            // Set current user properties header

            this._setUserPropertiesHeader();

            // Filter list per application configuration

            this._filterListPerApplicationConfiguration();
        },

        /**
         * Refresh from detail form is triggered       
         */

        onRefreshListFromDetail: function (sChannel, sEvent, oData) {


            this.ObjectIdToFocus = oData.ObjectId;

            this.onRefresh();

        },

        /**
         * After list data is available, this handler method updates the
         * list counter
         * @param {sap.ui.base.Event} oEvent the update finished event
         * @public
         */
        onUpdateFinished: function (oEvent) {


            var sObjectIds = [],
                t = this;;

            // update the list object counter after new data is loaded

            this._updateListItemCount(oEvent.getParameter("total"));

            for (var i = 0; i < this._oList.getItems().length; i++) {
                sObjectIds.push(this._oList.getItems()[i].getProperty('number'));
            }


            if (sObjectIds.indexOf(this.ObjectIdToFocus) > 0) {

                var oSelectedItem = t._oList.getItems()[sObjectIds.indexOf(this.ObjectIdToFocus)];

                this._oList.setSelectedItem(this.oSelectedItem, true, true);

            } else {

                // Select a first items if there are items in list

                var elementsCount = oEvent.getParameter("total");

                if (elementsCount !== 0) {

                    var oFirstItem = this._oList.getItems()[0];
                    this._oList.setSelectedItem(oFirstItem, true, true);


                } else {

                    // Show NoDataFound if there are no items in list

                    this.getRouter().getTargets().display("detailNoObjectsAvailable");

                } // if (elementsCount !== 0 )

            } // if (this.oSelectedItem)
        },

        /**
         * Event handler for the list search field. Applies current
         * filter value and triggers a new search. If the search field's
         * 'refresh' button has been pressed, no new search is triggered
         * and the list binding is refresh instead.
         * @param {sap.ui.base.Event} oEvent the search event
         * @public
         */
        onSearch: function (oEvent) {
 
            if (oEvent.getParameters().refreshButtonPressed) {
                // Search field's 'refresh' button has been pressed.
                // This is visible if you select any list item.
                // In this case no new search is triggered, we only
                // refresh the list binding.
                this.onRefresh();
                return;
            }

            var sQuery = oEvent.getParameter("query"),    
                oBindingInfo = this._oList.getBindingInfo("items");

                if (!oBindingInfo.parameters) {
                    oBindingInfo.parameters = {};
                }

            if (sQuery) {

                if (!oBindingInfo.parameters.custom) {
                    oBindingInfo.parameters.custom = {};
                }

                // Adding a search parameter
              
                oBindingInfo.parameters.custom.search = sQuery;

                this._oList.bindItems(oBindingInfo);

            } else {
                                
                    oBindingInfo.parameters.custom = {};
                            
                    this._oList.bindItems(oBindingInfo);

                    // Restoring filtering if it was used

                    if ( this._oListFilterState.aFilter ) {

                        this._applyFilterSearch();

                    }                   
            }
        },

        /**
         * Event handler for refresh event. Keeps filter, sort
         * and group settings and refreshes the list binding.
         * @public
         */
        onRefresh: function () {

            this._oList.getBinding("items").refresh();

            // Sending event to detail page via bus

            this.oEventBus.publish("ListAction", "onRefreshDetailFromList");

        },

        /**
         * Event handler for the filter, sort and group buttons to open the ViewSettingsDialog.
         * @param {sap.ui.base.Event} oEvent the button press event
         * @public
         */
        onOpenViewSettings: function (oEvent) {
            var sDialogTab = "filter";
            if (oEvent.getSource() instanceof sap.m.Button) {
                var sButtonId = oEvent.getSource().getId();
                if (sButtonId.match("sort")) {
                    sDialogTab = "sort";
                } else if (sButtonId.match("group")) {
                    sDialogTab = "group";
                }
            }
            // load asynchronous XML fragment
            if (!this.byId("viewSettingsDialog")) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "yslpmmyprb.view.ViewSettingsDialog",
                    controller: this
                }).then(function (oDialog) {
                    // connect dialog to the root view of this component (models, lifecycle)
                    this.getView().addDependent(oDialog);
                    oDialog.addStyleClass(this.getOwnerComponent().getContentDensityClass());
                    oDialog.open(sDialogTab);
                }.bind(this));
            } else {
                this.byId("viewSettingsDialog").open(sDialogTab);
            }
        },

        /**
         * Event handler called when ViewSettingsDialog has been confirmed, i.e.
         * has been closed with 'OK'. In the case, the currently chosen filters, sorters or groupers
         * are applied to the list, which can also mean that they
         * are removed from the list, in case they are
         * removed in the ViewSettingsDialog.
         * @param {sap.ui.base.Event} oEvent the confirm event
         * @public
         */
        onConfirmViewSettingsDialog: function (oEvent) {

            var aFilterItems = oEvent.getParameter("filterItems"),
                aFilters = [],
                aCaptions = [],
                t = this;

            aFilterItems.forEach(function (oItem) {
                switch (oItem.getKey()) {
                    case "openProblems":
                        aFilters.push(new Filter("Status", FilterOperator.EQ, t._getStatusCode("new")));
                        aFilters.push(new Filter("Status", FilterOperator.EQ, t._getStatusCode("approved")));
                        aFilters.push(new Filter("Status", FilterOperator.EQ, t._getStatusCode("inProcess")));
                        aFilters.push(new Filter("Status", FilterOperator.EQ, t._getStatusCode("customerAction")));
                        aFilters.push(new Filter("Status", FilterOperator.EQ, t._getStatusCode("solutionProvided")));
                        aFilters.push(new Filter("Status", FilterOperator.EQ, t._getStatusCode("onApproval")));
                        aFilters.push(new Filter("Status", FilterOperator.EQ, t._getStatusCode("informationRequested")));

                        break;
                    case "closedProblems":
                        aFilters.push(new Filter("Status", FilterOperator.EQ, t._getStatusCode("confirmed")));
                        aFilters.push(new Filter("Status", FilterOperator.EQ, t._getStatusCode("withdrawn")));
                        break;
                    default:
                        break;
                }
                aCaptions.push(oItem.getText());
            });
            this._oListFilterState.aFilter = aFilters;
            this._updateFilterBar(aCaptions.join(", "));
            this._applyFilterSearch();


            this._applySortGroup(oEvent);
        },

        /**
         * Apply the chosen sorter and grouper to the list
         * @param {sap.ui.base.Event} oEvent the confirm event
         * @private
         */
        _applySortGroup: function (oEvent) {
            var mParams = oEvent.getParameters(),
                sPath,
                bDescending,
                aSorters = [];

            sPath = mParams.sortItem.getKey();
            bDescending = mParams.sortDescending;
            aSorters.push(new Sorter(sPath, bDescending));
            this._oList.getBinding("items").sort(aSorters);
        },

        /**
         * Event handler for the list selection event
         * @param {sap.ui.base.Event} oEvent the list selectionChange event
         * @public
         */
        onSelectionChange: function (oEvent) {
            var oList = oEvent.getSource(),
                bSelected = oEvent.getParameter("selected");

            // skip navigation when deselecting an item in multi selection mode
            if (!(oList.getMode() === "MultiSelect" && !bSelected)) {
                // get the list item, either from the listItem parameter or from the event's source itself (will depend on the device-dependent mode).
                this._showDetail(oEvent.getParameter("listItem") || oEvent.getSource());
            }
        },

        /**
         * Event handler for the bypassed event, which is fired when no routing pattern matched.
         * If there was an object selected in the list, that selection is removed.
         * @public
         */
        onBypassed: function () {
            this._oList.removeSelections(true);
        },

        /**
         * Used to create GroupHeaders with non-capitalized caption.
         * These headers are inserted into the list to
         * group the list's items.
         * @param {Object} oGroup group whose text is to be displayed
         * @public
         * @returns {sap.m.GroupHeaderListItem} group header with non-capitalized caption.
         */
        createGroupHeader: function (oGroup) {
            return new GroupHeaderListItem({
                title: oGroup.text,
                upperCase: false
            });
        },

        /**
         * Event handler for navigating back.
         * We navigate back in the browser history
         * @public
         */
        onNavBack: function () {
            // eslint-disable-next-line sap-no-history-manipulation
            history.go(-1);
        },

        /* =========================================================== */
        /* begin: internal methods                                     */
        /* =========================================================== */

        /*
        * Set frontend constants
        */

        _setFrontendConstants: function () {

            // Getting frontend constants

            this.oFrontendConstants = this.getOwnerComponent().getModel("frontendConstants");

            // Filling status names constants

            this.statusNames = Object.freeze(this._setStatusNamesConstants());

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
        * Get status code
        */
        _getStatusCode: function (sStatusName) {
            
            var t = this;

            for (var key in t.statusNames) {

                if (sStatusName == key) {

                    return t.statusNames[key];

                }
            }
        },


        /**
         * Filter result list according to application configuration
         */
        _filterListPerApplicationConfiguration: function () {

            var oApplicationConfiguration = this.getOwnerComponent().getModel("applicationConfiguration"),
                oParameters = oApplicationConfiguration.oData.ApplicationConfiguration.results,
                t = this;

            for (var i = 0; i < oParameters.length; i++) {

                if (oParameters[i].Param.indexOf('SHOW_ONLY_PERSONAL_PROBLEMS') > 0) {

                    if (oParameters[i].Value === 'X') {

                        var oBinding = t._oList.getBinding("items"),
                            oFilter = [];

                        oFilter.push(new Filter("RequestorBusinessPartner", FilterOperator.EQ, t.oExecutionContext.oData.SystemUser.BusinessPartner));

                        oBinding.filter(oFilter);

                    }
                }
            }
        },

        /**
         * Set user properties header
         */
        _setUserPropertiesHeader: function () {

            var oExecutionContext = this.getOwnerComponent().getModel("executionContext");

            this.oExecutionContext = oExecutionContext;

            // Setting models to display user and company name

            this.byId("systemUserName").setModel(oExecutionContext, "runtimeModel");
            this.byId("systemUserCompanyName").setModel(oExecutionContext, "runtimeModel");

        },

        _createViewModel: function () {
            return new JSONModel({
                isFilterBarVisible: false,
                filterBarLabel: "",
                delay: 0,
                title: this.getResourceBundle().getText("listTitleCount", [0]),
                noDataText: this.getResourceBundle().getText("listListNoDataText"),
                sortBy: "ObjectId",
                groupBy: "None"
            });
        },

        _onMasterMatched: function () {
            //Set the layout property of the FCL control to 'OneColumn'
            this.getModel("appView").setProperty("/layout", "OneColumn");
        },

        /**
         * Shows the selected item on the detail page
         * On phones a additional history entry is created
         * @param {sap.m.ObjectListItem} oItem selected Item
         * @private
         */
        _showDetail: function (oItem) {
            var bReplace = !Device.system.phone;
            // set the layout property of FCL control to show two columns
            this.getModel("appView").setProperty("/layout", "TwoColumnsMidExpanded");
            this.getRouter().navTo("object", {
                objectId: oItem.getBindingContext().getProperty("Guid")
            }, bReplace);
        },

        /**
         * Sets the item count on the list header
         * @param {integer} iTotalItems the total number of items in the list
         * @private
         */
        _updateListItemCount: function (iTotalItems) {
            var sTitle;
            // only update the counter if the length is final
            if (this._oList.getBinding("items").isLengthFinal()) {
                sTitle = this.getResourceBundle().getText("listTitleCount", [iTotalItems]);
                this.getModel("listView").setProperty("/title", sTitle);
            }
        },

        /**
         * Internal helper method to apply both filter and search state together on the list binding
         * @private
         */
        _applyFilterSearch: function () {
            var aFilters = this._oListFilterState.aSearch.concat(this._oListFilterState.aFilter),
                oViewModel = this.getModel("listView");
            this._oList.getBinding("items").filter(aFilters, "Application");
            // changes the noDataText of the list in case there are no filter results
            if (aFilters.length !== 0) {
                oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("listListNoDataWithFilterOrSearchText"));
            } else if (this._oListFilterState.aSearch.length > 0) {
                // only reset the no data text to default when no new search was triggered
                oViewModel.setProperty("/noDataText", this.getResourceBundle().getText("listListNoDataText"));
            }
        },

        /**
         * Internal helper method that sets the filter bar visibility property and the label's caption to be shown
         * @param {string} sFilterBarText the selected filter value
         * @private
         */
        _updateFilterBar: function (sFilterBarText) {
            var oViewModel = this.getModel("listView");
            oViewModel.setProperty("/isFilterBarVisible", (this._oListFilterState.aFilter.length > 0));
            oViewModel.setProperty("/filterBarLabel", this.getResourceBundle().getText("listFilterBarText", [sFilterBarText]));
        }

    });

});