sap.ui.define([
  "./BaseController",
  "sap/ui/model/odata/v2/ODataModel",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/Sorter",
  "sap/ui/model/FilterOperator",
  "sap/m/GroupHeaderListItem",
  "sap/ui/Device",
  "sap/ui/core/Fragment",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/base/Log",
  "../model/formatter"
], function (BaseController, ODataModel, JSONModel, Filter, Sorter,
  FilterOperator, GroupHeaderListItem, Device, Fragment, MessageBox,
  MessageToast, Log, formatter) {
  "use strict";

  return BaseController.extend(
    "com.aramco.ZSCM_CT_COMPONENT.controller.Master", {

      formatter: formatter,

      /* =========================================================== */
      /* lifecycle methods                                           */
      /* =========================================================== */

      /**
       * Called when the master list controller is instantiated. It sets up the event handling for the master/detail communication and other lifecycle tasks.
       * @public
       */
      onInit: function () {
        // Control state model
        var oList = this.byId("list"),
          oViewModel = this._createViewModel(),
          // Put down master list's original value for busy indicator delay,
          // so it can be restored later on. Busy handling on the master list is
          // taken care of by the master list itself.
          iOriginalBusyDelay = oList.getBusyIndicatorDelay();

        this._oGroupFunctions = {
          Category: function (oContext) {
            var sCategory = oContext.getProperty("Category"),
              key, text;
            if (sCategory === "IN") {
              key = "IN";
              text = this.getResourceBundle().getText("masterGroupCatHeaderInv");
            } else if (sCategory === "LG") {
              key = "LG";
              text = this.getResourceBundle().getText("masterGroupCatHeaderLog");
            } else {
              key = "PR";
              text = this.getResourceBundle().getText("masterGroupCatHeaderProc");
            }
            return {
              key: key,
              text: text
            };
          }.bind(this),
          
          Criticality: function (oContext) {
            var sLevel = oContext.getProperty("Criticality"),
              key, text;
            if (sLevel === "C") {
              key = "C";
              text = this.getResourceBundle().getText("masterGroupLevelHeaderC");
            } else if (sLevel === "W") {
              key = "W";
              text = this.getResourceBundle().getText("masterGroupLevelHeaderW");
            } else {
              key = "N";
              text = this.getResourceBundle().getText("masterGroupLevelHeaderN");
            }
            return {
              key: key,
              text: text
            };
          }.bind(this)
        };

        this._oList = oList;
        // keeps the filter and search state
        this._oListFilterState = {
          aFilter: [],
          aSearch: []
        };

        this.setModel(oViewModel, "masterView");
        // Make sure, busy indication is showing immediately so there is no
        // break after the busy indication for loading the view's meta data is
        // ended (see promise 'oWhenMetadataIsLoaded' in AppController)
        oList.attachEventOnce("updateFinished", function () {
          // Restore original busy indicator delay for the list
          oViewModel.setProperty("/delay",
            iOriginalBusyDelay);
        });

        this.getView()
          .addEventDelegate({
            onBeforeFirstShow: function () {
              this.getOwnerComponent()
                .oListSelector.setBoundMasterList(oList);
            }.bind(this)
          });

        this.getRouter()
          .getRoute("master")
          .attachPatternMatched(this._onMasterMatched, this);
        this.getRouter()
          .attachBypassed(this.onBypassed, this);
          
        // Check if user first access, show guide popup
        this.checkUserFristAccess();
      },

      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */

      /**
       * After list data is available, this handler method updates the
       * master list counter
       * @param {sap.ui.base.Event} oEvent the update finished event
       * @public
       */
      onUpdateFinished: function (oEvent) {
        // update the master list object counter after new data is loaded
        this._updateListItemCount(oEvent.getParameter("total"));
      },

      /**
       * Event handler for the master search field. Applies current
       * filter value and triggers a new search. If the search field's
       * 'refresh' button has been pressed, no new search is triggered
       * and the list binding is refresh instead.
       * @param {sap.ui.base.Event} oEvent the search event
       * @public
       */
      onSearch: function (oEvent) {
        if (oEvent.getParameters()
          .refreshButtonPressed) {
          // Search field's 'refresh' button has been pressed.
          // This is visible if you select any master list item.
          // In this case no new search is triggered, we only
          // refresh the list binding.
          this.onRefresh();
          return;
        }

        var sQuery = oEvent.getParameter("query");

        if (sQuery) {
          this._oListFilterState.aSearch = [new Filter(
            "Title", FilterOperator.Contains, sQuery)];
        } else {
          this._oListFilterState.aSearch = [];
        }
        this._applyFilterSearch();

      },

      /**
       * Event handler for refresh event. Keeps filter, sort
       * and group settings and refreshes the list binding.
       * @public
       */
      onRefresh: function () {
        this._oList.getBinding("items")
          .refresh();
      },

      /**
       * Event handler for the filter, sort and group buttons to open the ViewSettingsDialog.
       * @param {sap.ui.base.Event} oEvent the button press event
       * @public
       */
      onOpenViewSettings: function (oEvent) {
        var sDialogTab = "filter";
        if (oEvent.getSource() instanceof sap.m.Button) {
          var sButtonId = oEvent.getSource()
            .getId();
          if (sButtonId.match("sort")) {
            sDialogTab = "sort";
          } else if (sButtonId.match("group")) {
            sDialogTab = "group";
          }
        }
        // load asynchronous XML fragment
        if (!this.byId("viewSettingsDialog")) {
          Fragment.load({
              id: this.getView()
                .getId(),
              name: "com.aramco.ZSCM_CT_COMPONENT.fragment.ViewSettingsDialog",
              controller: this
            })
            .then(function (oDialog) {
              // connect dialog to the root view of this component (models, lifecycle)
              this.getView()
                .addDependent(oDialog);
              oDialog.addStyleClass(this.getOwnerComponent()
                .getContentDensityClass());
              oDialog.open(sDialogTab);
            }.bind(this));
        } else {
          this.byId("viewSettingsDialog")
            .open(sDialogTab);
        }
      },

      /**
       * Event handler called when ViewSettingsDialog has been confirmed, i.e.
       * has been closed with 'OK'. In the case, the currently chosen filters, sorters or groupers
       * are applied to the master list, which can also mean that they
       * are removed from the master list, in case they are
       * removed in the ViewSettingsDialog.
       * @param {sap.ui.base.Event} oEvent the confirm event
       * @public
       */
      onConfirmViewSettingsDialog: function (oEvent) {
        var aFilterItems = oEvent.getParameters()
          .filterItems,
          aFilters = [],
          aCaptions = [];

        // update filter state:
        // combine the filter array and the filter string
        aFilterItems.forEach(function (oItem) {
          switch (oItem.getKey()) {
          case "SourceBEx":
            aFilters.push(new Filter("Source", FilterOperator.EQ, "B"));
            break;
          case "SourceHANA":
            aFilters.push(new Filter("Source", FilterOperator.EQ, "H"));
            break;
          case "CatInv":
            aFilters.push(new Filter("Category", FilterOperator.EQ, "IN"));
            break;
          case "CatLog":
            aFilters.push(new Filter("Category", FilterOperator.EQ, "LG"));
            break;
          case "CatProc":
            aFilters.push(new Filter("Category", FilterOperator.EQ, "PR"));
            break;
          case "LevelC":
            aFilters.push(new Filter("Criticality", FilterOperator.EQ, "C"));
            break;
          case "LevelW":
            aFilters.push(new Filter("Criticality", FilterOperator.EQ, "W"));
            break;
          case "LevelN":
            aFilters.push(new Filter("Criticality", FilterOperator.EQ, "N"));
            break;
          case "ShownY":
            aFilters.push(new Filter("ShowOnCT", FilterOperator.EQ, true));
            break;
          case "ShownN":
            aFilters.push(new Filter("ShowOnCT", FilterOperator.EQ, false));
            break;
          case "EmailAuto":
            aFilters.push(new Filter("AutoEmail", FilterOperator.EQ, true));
            break;
          case "EmailManual":
            aFilters.push(new Filter("AutoEmail", FilterOperator.EQ, false));
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
       * Apply the chosen sorter and grouper to the master list
       * @param {sap.ui.base.Event} oEvent the confirm event
       * @private
       */
      _applySortGroup: function (oEvent) {
        var mParams = oEvent.getParameters(),
          sPath,
          bDescending,
          aSorters = [];
        // apply sorter to binding
        // (grouping comes before sorting)
        if (mParams.groupItem) {
          sPath = mParams.groupItem.getKey();
          bDescending = mParams.groupDescending;
          var vGroup = this._oGroupFunctions[sPath];
          aSorters.push(new Sorter(sPath, bDescending, vGroup));
        }
        sPath = mParams.sortItem.getKey();
        bDescending = mParams.sortDescending;
        aSorters.push(new Sorter(sPath, bDescending));
        
        // If sort by changed date, add changed time to the sorter
        if (sPath === "ChangedOn") {
          aSorters.push(new Sorter("ChangedAt", bDescending));
        }
        
        this._oList.getBinding("items")
          .sort(aSorters);
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
          this._showDetail(oEvent.getParameter("listItem") ||
            oEvent.getSource());
        }
      },

      /**
       * Event handler for the bypassed event, which is fired when no routing pattern matched.
       * If there was an object selected in the master list, that selection is removed.
       * @public
       */
      onBypassed: function () {
        this._oList.removeSelections(true);
      },

      /**
       * Used to create GroupHeaders with non-capitalized caption.
       * These headers are inserted into the master list to
       * group the master list's items.
       * @param {Object} oGroup group whose text is to be displayed
       * @public
       * @returns {sap.m.GroupHeaderListItem} group header with non-capitalized caption.
       */
      createGroupHeader: function (oGroup) {
        return new GroupHeaderListItem({
          title: oGroup.text,
          upperCase: false,
          customData: new sap.ui.core.CustomData({
            key: "bg",
            value: "dark",
            writeToDom: true
          })
        });
      },

      /**
       * Event handler for navigating back.
       * We navigate back in the browser historz
       * @public
       */
      onNavBack: function () {
        // eslint-disable-next-line sap-no-history-manipulation
        history.go(-1);
      },
      
      /**
       * Event handler to open the CreateAlertDialog
       * @param {sap.ui.base.Event} oEvent the button press event
       * @public
       */
      onOpenCreateAlertDialog: function (oEvent) {
        var oView = this.getView();
        
        if (!this.byId("createAlertDialog")) {
          Fragment.load({
            id: oView.getId(),
            name: "com.aramco.ZSCM_CT_COMPONENT.fragment.CreateAlertDialog",
            controller: this
          })
          .then(function (oDialog) {
              oView.addDependent(oDialog);
              
              oDialog.addStyleClass(this.getOwnerComponent()
                .getContentDensityClass());
                
              this._resetCreateAlertModel();
                
              oDialog.open();
            }.bind(this));
        } else {
          this._resetCreateAlertModel();
          this.byId("createAlertDialog").open();
        }
      },
      
      /**
       * Event handler to validate user input and create new alert
       * @public
       */
      onCreateAlertPress: function () {
        // Check if show on CT is checked and order is set, if valid save
        this.checkValidOrder();
      },
      
      /**
       * Event handler to close  the CreateAlertDialog
       * @public
       */
      onCloseCreateAlertDialog: function () {
        this.byId("createAlertDialog").close();
      },
      
      /**
       * Event handler to check user input
       * @param {Event} oEvent control event
       * @public
       */
      onCreateAlertLiveChange: function (oEvent) {
        var oView = this.getView(),
            oViewModel = this.getModel("masterView"),
            oValidation = oViewModel.getProperty("/validation"),
            oSource = oEvent.getSource(),
            sId = oSource.getId(),
            sValue = oSource.getValue(),
            sTitleInputId = oView.createId("createAlertTitleInput"),
            sTechNameInputId = oView.createId("createAlertTechNameInput"),
            sOrderInputId = oView.createId("createAlertOrderOnCTInput");
        
        if (sId === sTitleInputId && sValue) {
          oValidation.TitleState = "None";
          oValidation.TitleStateText = "";
        }
        
        if (sId === sTechNameInputId && sValue) {
          oValidation.TechNameState = "None";
          oValidation.TechNameStateText = "";
        }
        
        if (sId === sOrderInputId && sValue) {
          oValidation.OrderState = "None";
          oValidation.OrderStateText = "";
        }
        
        oViewModel.setProperty("/validation", oValidation);
      },
      
      /**
       * Validates the technical name of the BEx query against user input
       * @param {Event} oEvent control event
       * @private
       */
      onTechNameChange: function (oEvent) {
        var oModel = this._oList.getModel(),
            oMsg = this.getResourceBundle(),
            oViewModel = this.getModel("masterView"),
            oValidation = oViewModel.getProperty("/validation"),
            oSource = oEvent.getSource(),
            oValue = oEvent.getParameters().value;
            
        // Check the source is BEx query
        if (!oViewModel.getProperty("/createAlert").Source === "B") {
          oValidation.TechNameValid = true;
          oValidation.TechNameState = "None";
          oValidation.TechNameStateText = "";
          
          oViewModel.setProperty("/validation", oValidation);
          
          oSource.setBusy(false);
          
          return;
        }
            
        // Set input busy
        oSource.setBusy(true);
            
        // Check value is not empty
        if (!oValue) {
          oValidation.TechNameValid = false;
          oValidation.TechNameState = "Error";
          oValidation.TechNameStateText = oMsg.getText("requiredField");
          
          oViewModel.setProperty("/validation", oValidation);
          
          oSource.setBusy(false);
          
          return;
        }
        
        // Check validity of BEx query
        oModel.callFunction(
          "/CheckValidBExQuery",
          {
            urlParameters: {
              QueryName: oValue
            },
            success: function (oData) {
              oSource.setBusy(false);
              
              Log.debug(oData);
              
              var bValid = oData.CheckValidBExQuery.IsValid;
              
              if (bValid) {
                oValidation.TechNameValid = true;
                oValidation.TechNameState = "Success";
                oValidation.TechNameStateText = "";
              } else {
                oValidation.TechNameValid = false;
                oValidation.TechNameState = "Error";
                oValidation.TechNameStateText = oMsg.getText("invalidBExQuery");
              }
              
              oViewModel.setProperty("/validation", oValidation);
            },
            error: function (oError) {
              oSource.setBusy(false);
              Log.error("Error while checking BEx Query name: " + oValue);
            }
          }
        );
      },
      
      /**
       * When alert not shown on CT, reset order to 0
       * @param {Event} oEvent control event
       * @public
       */
      onShowOnCTSelect: function (oEvent){
        var oViewModel = this.getModel("masterView"),
            bSelected = oEvent.getParameters().selected;
        
        if (!bSelected) {
          oViewModel.setProperty("/createAlert/OrderOnCT", "0");
        }
      },
      
      /**
       * Event handler to handle source, category and level selection change
       * @param {Event} oEvent control event
       * @public
       */
      onSelectChange: function (oEvent) {
        var oView = this.getView(),
            oViewModel = this.getModel("masterView"),
            oSelectedItem = oEvent.getParameters().selectedItem,
            sSelectId = oEvent.getSource().getId(),
            sText = oSelectedItem.getText(),
            sSourceId = oView.createId("createAlertSourceSelect"),
            sCategoryId = oView.createId("createAlertCategorySelect"),
            sLevelId = oView.createId("createAlertLevelSelect");
        
        switch(sSelectId) {
          case sSourceId:
            if (oSelectedItem.getKey()) {
              oViewModel.setProperty("/validation/SourceState", "None");
              oViewModel.setProperty("/validation/SourceStateText", "");
            }
            
            oViewModel.setProperty("/createAlert/SourceText", sText);
            break;
          case sCategoryId:
              if (oSelectedItem.getKey()) {
              oViewModel.setProperty("/validation/CategoryState", "None");
              oViewModel.setProperty("/validation/CategoryStateText", "");
            }
            
            oViewModel.setProperty("/createAlert/CategoryText", sText);
            // Reset page number also
            oViewModel.setProperty("/createAlert/PageNo", "1");
            break;
          case sLevelId:
            oViewModel.setProperty("/createAlert/CriticalityText", sText);
            break;
        }
      },
      
      /**
       * Event to set default texts ones select control receives data from backend
       * @param {Event} oEvent control event
       */
      onSelectDataReceived: function (oEvent) {
        var oViewModel = this.getModel("masterView"),
            oFirstItem = oEvent.getParameters().data.results[0],
            sPath = oEvent.getSource().getPath();

        switch (sPath) {
          case "/Sources":
            oViewModel.setProperty("/createAlert/Source", oFirstItem.Key);
            oViewModel.setProperty("/createAlert/SourceText", oFirstItem.Text);
            break;
          case "/Categories":
            oViewModel.setProperty("/createAlert/Category", oFirstItem.Key);
            oViewModel.setProperty("/createAlert/CategoryText", oFirstItem.Text);
            break;
          case "/Levels":
            oViewModel.setProperty("/createAlert/Criticality", oFirstItem.Key);
            oViewModel.setProperty("/createAlert/CriticalityText", oFirstItem.Text);
            break;
        }
      },
      
      /**
       * Opens order value help dialog
       * @param {Event} oEvent control event
       */
      onOrderValueHelpRequest: function (oEvent) {
        var oView = this.getView(),
            oAppModel = this.getModel("appView"),
            oViewModel = this.getModel("masterView"),
            oInput = oViewModel.getProperty("/createAlert"),
            sCategory = oInput.Category,
            sPageNo = oInput.PageNo;
        
        // Get the source input field
        this._orderInputField = oEvent.getSource();
        var sOrder = this._orderInputField.getValue();
        
        // Reset all blocks visibility
        oAppModel.setProperty("/orderHelpCategoryINVisible", false);
        oAppModel.setProperty("/orderHelpCategoryLGVisible", false);
        oAppModel.setProperty("/orderHelpCategoryPRVisible", false);
        oAppModel.setProperty("/orderHelpCategoryPR2Visible", false);
        
        switch (sCategory) {
          case "IN":
              oAppModel.setProperty("/orderHelpCategoryINVisible", true);
            break;
          case "LG":
              oAppModel.setProperty("/orderHelpCategoryLGVisible", true);
            break;
          case "PR":
            if (sPageNo.replace(/\b0+/, "") === "1") {
              oAppModel.setProperty("/orderHelpCategoryPRVisible", true);
            } else {
              oAppModel.setProperty("/orderHelpCategoryPR2Visible", true);
            }
            break;
        }
        
        oAppModel.setProperty("/orderValue", sOrder);
        
        if (!this.byId("orderValueHelpDialog")) {
          Fragment.load({
            id: oView.getId(),
            name: "com.aramco.ZSCM_CT_COMPONENT.fragment.OrderValueHelpDialog",
            controller: this
          })
          .then(function (oDialog) {
              oView.addDependent(oDialog);
              
              oDialog.addStyleClass(this.getOwnerComponent()
                .getContentDensityClass());
                
              oDialog.open();
            }.bind(this));
        } else {
          this.byId("orderValueHelpDialog").open();
        }
      },
      
      /**
       * Gets the selected alert position from popup
       * @param {Event} oEvent control event
       * @private
       */
      onOrderValueSelect: function (oEvent) {
        var oView = this.getView(),
            oDialog = this.byId("orderValueHelpDialog"),
            sId = oEvent.getSource().getId(),
            sCancelId = oView.createId("orderHelpCancelButton");
        
        if (sId === sCancelId) {
          oDialog.close();
          return;
        }
        
        var sOrder = sId.substr(sId.lastIndexOf("-") + 1);
        
        this._orderInputField.setValue(sOrder);
        
        oDialog.close();
      },

      /* =========================================================== */
      /* begin: internal methods                                     */
      /* =========================================================== */

      _createViewModel: function () {
        return new JSONModel({
          isFilterBarVisible: false,
          filterBarLabel: "",
          delay: 0,
          title: this.getResourceBundle()
            .getText("masterTitleCount", [0]),
          noDataText: this.getResourceBundle()
            .getText("masterListNoDataText"),
          sortBy: "Title",
          groupBy: "None"
        });
      },

      _onMasterMatched: function () {
        //Set the layout property of the FCL control to 'OneColumn'
        this.getModel("appView")
          .setProperty("/layout", "OneColumn");
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
        this.getModel("appView")
          .setProperty("/layout", "TwoColumnsMidExpanded");
        this.getRouter()
          .navTo("alert", {
            alertId: oItem.getBindingContext()
              .getProperty("AlertId")
          }, bReplace);
      },

      /**
       * Sets the item count on the master list header
       * @param {integer} iTotalItems the total number of items in the list
       * @private
       */
      _updateListItemCount: function (iTotalItems) {
        var sTitle;
        // only update the counter if the length is final
        if (this._oList.getBinding("items")
          .isLengthFinal()) {
          sTitle = this.getResourceBundle()
            .getText("masterTitleCount", [iTotalItems]);
          this.getModel("masterView")
            .setProperty("/title", sTitle);
        }
      },

      /**
       * Internal helper method to apply both filter and search state together on the list binding
       * @private
       */
      _applyFilterSearch: function () {
        var aFilters = this._oListFilterState.aSearch.concat(
            this._oListFilterState.aFilter),
          oViewModel = this.getModel("masterView");
        this._oList.getBinding("items")
          .filter(aFilters, "Application");
        // changes the noDataText of the list in case there are no filter results
        if (aFilters.length !== 0) {
          oViewModel.setProperty("/noDataText", this.getResourceBundle()
            .getText(
              "masterListNoDataWithFilterOrSearchText"));
        } else if (this._oListFilterState.aSearch.length > 0) {
          // only reset the no data text to default when no new search was triggered
          oViewModel.setProperty("/noDataText", this.getResourceBundle()
            .getText("masterListNoDataText"));
        }
      },

      /**
       * Internal helper method that sets the filter bar visibility property and the label's caption to be shown
       * @param {string} sFilterBarText the selected filter value
       * @private
       */
      _updateFilterBar: function (sFilterBarText) {
        var oViewModel = this.getModel("masterView");
        oViewModel.setProperty("/isFilterBarVisible", (this._oListFilterState
          .aFilter.length > 0));
        oViewModel.setProperty("/filterBarLabel", this.getResourceBundle()
          .getText("masterFilterBarText", [sFilterBarText])
        );
      },
      
      /**
       * Create and restting json model for create new alert dialog
       * @private
       */
      _resetCreateAlertModel: function () {
        var oView = this.getView(),
            oViewModel = this.getModel("masterView"),
            oSrcSelect = oView.byId("createAlertSourceSelect"),
            oCatSelect = oView.byId("createAlertCategorySelect"),
            oCrtSelect = oView.byId("createAlertLevelSelect");
        
        var oAlert = {
          Title: "",
          Source: "",
          SourceText: "",
          TechnicalName: "",
          Uom: "",
          Category: "",
          CategoryText: "",
          PageNo: "1",
          Criticality: "",
          CriticalityText: "",
          Detail: "",
          ShowOnCT: false,
          OrderOnCT: "0",
		  Trend: true,
          AutoEmail: false,
          EmailTo: "",
          EmailCC: "",
          EmailBody: "",
          Frequency: "",
          FrequencyText: "",
          ChangedBy: "",
          ChangedOn: "/Date(" + new Date().getTime() + ")/",
          ChangedAt: "PT" + new Date().getHours() + "H" + new Date().getMinutes() + "M" + new Date().getSeconds() + "S"
        };
        
        // Check if select items binding is not null, then set first item
        if (oSrcSelect) {
          var oSrcBinding = oSrcSelect.getBinding("items").getContexts(),
              oSrcObj = {};
          
          if (Array.isArray(oSrcBinding) && oSrcBinding.length) {
            oSrcObj = oSrcBinding[0].getObject();
            
            oAlert.Source = oSrcObj.Key;
            oAlert.SourceText = oSrcObj.Text;
          }
              
        }
        
        if (oCatSelect) {
          var oCatBinding = oCatSelect.getBinding("items").getContexts(),
              oCatObj = {};
          
          if (Array.isArray(oCatBinding) && oCatBinding.length) {
            oCatObj = oCatBinding[0].getObject();
            
            oAlert.Category = oCatObj.Key;
            oAlert.CategoryText = oCatObj.Text;
          }
              
        }
        
        if (oCrtSelect) {
          var oCrtBinding = oCrtSelect.getBinding("items").getContexts(),
              oCrtObj = {};
          
          if (Array.isArray(oCrtBinding) && oCrtBinding.length) {
            oCrtObj = oCrtBinding[0].getObject();
            
            oAlert.Criticality = oCrtObj.Key;
            oAlert.CriticalityText = oCrtObj.Text;
          }
              
        }
        
        var oValidation = {
          TitleState: "None",
          TitleStateText: "",
          SourceState: "None",
          SourceStateText: "",
          TechNameValid: false,
          TechNameState: "None",
          TechNameStateText: "",
          CategoryState: "None",
          CategoryStateText: "",
          OrderState: "None",
          OrderStateText: ""
        };
        
        oViewModel.setProperty("/createAlert", oAlert);
        oViewModel.setProperty("/validation", oValidation);
      },
      
      /**
       * Checks if the current order is not reserved for another alert or 
       * exceeds maximum number of displayed alerts
       * @private
       */
      checkValidOrder: function () {
        var oView = this.getView(),
            oModel = this._oList.getModel(),
            oViewModel = this.getModel("masterView"),
            oMsg = this.getResourceBundle(),
            oAlert = oViewModel.getProperty("/createAlert"),
            bShowOnCT = oAlert.ShowOnCT,
            sId = oAlert.AlertId || "",
            sCategory = oAlert.Category,
            sPage = oAlert.PageNo,
            sOrder = oAlert.OrderOnCT,
            sMsg = "";
            
        if (!bShowOnCT) {
          this.validateAndSave();
          return;
        } else {
          if (!/^\d+$/.test(sOrder) || parseFloat(sOrder) < 1) {
            sMsg = oMsg.getText("orderOnCTZero");
            oViewModel.setProperty("/validation/OrderState", "Error");
            oViewModel.setProperty("/validation/OrderStateText", sMsg);
            return;
          }
        }
        
        oModel.callFunction(
          "/CheckValidOrder",
          {
            urlParameters: {
              AlertId: sId,
              Category: sCategory,
              PageNo: sPage,
              Order: sOrder
            },
            
            success: function (oData) {
              var oCheckOrder = oData.CheckValidOrder;
              
              if (oCheckOrder.ExceedsMax) {
                sMsg = oMsg.getText("orderExceedsMax");
                oViewModel.setProperty("/validation/OrderState", "Error");
                oViewModel.setProperty("/validation/OrderStateText", sMsg);
              } else if (oCheckOrder.IsReserved) {
                oViewModel.setProperty("/validation/OrderState", "None");
                oViewModel.setProperty("/validation/OrderStateText", "");
                
                MessageBox.confirm(
                  oMsg.getText("orderReservedConfirm", [oCheckOrder.CurrentAlert]),
                  {
                    styleClass: this.getOwnerComponent().getContentDensityClass(),
                    actions: [
                      sap.m.MessageBox.Action.YES,
                      sap.m.MessageBox.Action.NO
                    ],
                    initialFocus: sap.m.MessageBox.Action.NO,
                    onClose: function (oAction) {
                      if (oAction === sap.m.MessageBox.Action.YES) {
                        this.validateAndSave();
                      }
                    }.bind(this)
                  }
                );
              } else if (!oCheckOrder.ExceedsMax && !oCheckOrder.IsReserved) {
                this.validateAndSave();
              }
            }.bind(this),
            
            error: function (oError) {
              oView.setBusy(false);
              Log.error(oMsg.getText("validateOrderFail"));
            }
          }
        );
      },
      
      validateAndSave: function () {
        var oModel = this._oList.getModel(),
            oMsg = this.getResourceBundle(),
            oViewModel = this.getModel("masterView"),
            oInputAlert = oViewModel.getProperty("/createAlert"),
            oValidation = oViewModel.getProperty("/validation"),
            oDialog = this.byId("createAlertDialog"),
            bValid = true;
        
        // Validate user input
        if (!oInputAlert.Title) {
          oValidation.TitleState = "Error";
          oValidation.TitleStateText = oMsg.getText("requiredField");
          bValid = false;
        }
        
        if(!oInputAlert.Source) {
          oValidation.SourceState = "Error";
          oValidation.SourceStateText = oMsg.getText("requiredField");
          bValid = false;
        }
        
        if (!oInputAlert.TechnicalName) {
          oValidation.TechNameState = "Error";
          oValidation.TechNameStateText = oMsg.getText("requiredField");
          bValid = false;
        }
        
        if (!oValidation.TechNameValid) {
          bValid = false;
        }
        
        if(!oInputAlert.Category) {
          oValidation.CategoryState = "Error";
          oValidation.CategoryStateText = oMsg.getText("requiredField");
          bValid = false;
        }
        
        if (oInputAlert.ShowOnCT) {
          var sOrder = oInputAlert.OrderOnCT;
          
          if (!/^\d+$/.test(sOrder) || parseFloat(sOrder) < 1) {
            oValidation.OrderState = "Error";
            oValidation.OrderStateText = oMsg.getText("orderOnCTZero");
            bValid = false;
          }
        }
        
        // if not valid, stop processing new alert
        if(!bValid) {
          oViewModel.setProperty("/validation", oValidation);
          return;
        }
        
        // Create the alert
        oDialog.setBusy(true);
        oModel.create(
          "/Alerts",
          oInputAlert,
          {
            success: function (oData) {
              oDialog.setBusy(false);
              
              MessageToast.show(
                oMsg.getText("masterCreateAlertSuccess"),
                {
                  width: "40%"
                }
              );
              oDialog.close();
            },
            error: function (oError) {
              oDialog.setBusy(false);
              
              MessageToast.show(
                oMsg.getText("masterCreateAlertFail"),
                {
                  width: "40%"
                }
              );
            }
          }
        );
      },
      
       /**
       * Checks if this is user's first access, show him the guide popup
       */
      checkUserFristAccess: function () {
        var oStorage = jQuery.sap.storage(jQuery.sap.storage.Type.local),
            bFirstVisit = oStorage.get("zscm-ct-visited") !== "X";
        
        if (bFirstVisit)  {
          oStorage.put("zscm-ct-visited", "X");
          this.showHelpMessageBox();
        }
      },
      
      /**
       * Shows guide popup
       */
      showHelpMessageBox: function () {
        var oMsg = this.getResourceBundle(),
            sURL = "https://" + "www.aramco.com/";
            
        MessageBox.show(
          oMsg.getText("guideMessage"),
          {
            title: oMsg.getText("guideTitle"),
            details: oMsg.getText("guideDetails", [sURL]),
            styleClass: this.getOwnerComponent()
              .getContentDensityClass(),
            actions: sap.m.MessageBox.Action.OK,
            initialFocus: sap.m.MessageBox.Action.OK
          }
        );
      }

    });

});