sap.ui.define(
  [
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/Device",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/base/Log",
    "./BaseController",
    "../model/formatter"
  ],
  function (
    JSONModel,
    Fragment,
    Device,
    MessageBox,
    MessageToast,
    Log,
    BaseController,
    formatter
  ) {
    "use strict";

    return BaseController.extend("com.aramco.ZSCM_CT_COMPONENT.controller.Detail", {
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
          editMode: false
        });

        this.getRouter()
          .getRoute("alert")
          .attachPatternMatched(this._onObjectMatched, this);

        this.setModel(oViewModel, "detailView");

        this.getOwnerComponent()
          .getModel()
          .metadataLoaded()
          .then(this._onMetadataLoaded.bind(this));

        this._formFragments = {};

        // Set the initial form as display
        this._showFormFragment("Display");
      },

      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */

      /**
       * Event handler when edit button has been clicked
       * @public
       */
      onEditAlertPress: function () {
        this._toggleEditMode(true);
      },

      /**
       * Event handler when cancel button has been clicked
       * @public
       */
      onCancelPress: function () {
        var oMsg = this.getResourceBundle();

        // Compare bound alert data with user input. If different, prompt
        var isModified = this.alertDataChanged();

        if (isModified) {
          MessageBox.confirm(oMsg.getText("confirmCancelEdit"), {
            styleClass: this.getOwnerComponent().getContentDensityClass(),
            actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
            initialFocus: sap.m.MessageBox.Action.NO,
            onClose: function (oAction) {
              if (oAction === sap.m.MessageBox.Action.YES) {
                this.setAlertDataModel();
                this._toggleEditMode(false);
              }
            }.bind(this)
          });
        } else {
          this._toggleEditMode(false);
        }
      },

      /**
       * Event handler when Delete button has been clicked
       * @public
       */
      onDeletePress: function () {
        Log.info("delete pressed");
        var oView = this.getView(),
          oMsg = this.getResourceBundle(),
          oBinding = oView.getElementBinding(),
          oModel = oBinding.getModel(),
          oViewModel = this.getModel("detailView"),
          oAlert = oViewModel.getProperty("/alertData"),
          sId = oAlert.AlertId || "";
       // console.log({ sId });
        MessageBox.confirm(oMsg.getText("confirmDelete"), {
          styleClass: this.getOwnerComponent().getContentDensityClass(),
          actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
          initialFocus: sap.m.MessageBox.Action.NO,
          onClose: function (oAction) {
            if (oAction === sap.m.MessageBox.Action.YES && sId) {
              oModel.remove(`/Alerts('${sId}')`, {
                success: function (oData, oResponse) {
                  // Success
                  console.log(" Deleted Successfully");
                  setTimeout(async () => {
                    MessageToast.show(oMsg.getText("deleteSuccess"), {
                      width: "40%"
                    });
                    await new Promise((r) => setTimeout(r, 2222));
                    this.onCloseDetailPress();
                  });
                }.bind(this),
                error: function (oError) {
                  // Error
                  MessageToast.show("Fail to delete the alert()");
                  console.log(" Delete failed");
                }
              });
            }
          }.bind(this)
        });
      },
      /**
       * Event handler when save button has been clicked
       * @public
       */
      onSavePress: function () {
        // Check if show on CT is checked and order is set, if valid save
        this.checkValidOrder();
      },

      /**
       * Set the full screen mode to false and navigate to master page
       */
      onCloseDetailPress: function () {
        this.getModel("appView").setProperty(
          "/actionButtonsInfo/midColumn/fullScreen",
          false
        );
        // No item should be selected on master after detail page is closed
        this.getOwnerComponent().oListSelector.clearMasterListSelection();
        this.getRouter().navTo("master");
      },

      /**
       * Toggle between full and non full screen mode.
       */
      toggleFullScreen: function () {
        var bFullScreen = this.getModel("appView").getProperty(
          "/actionButtonsInfo/midColumn/fullScreen"
        );
        this.getModel("appView").setProperty(
          "/actionButtonsInfo/midColumn/fullScreen",
          !bFullScreen
        );
        if (!bFullScreen) {
          // store current layout and go full screen
          this.getModel("appView").setProperty(
            "/previousLayout",
            this.getModel("appView").getProperty("/layout")
          );
          this.getModel("appView").setProperty(
            "/layout",
            "MidColumnFullScreen"
          );
        } else {
          // reset to previous layout
          this.getModel("appView").setProperty(
            "/layout",
            this.getModel("appView").getProperty("/previousLayout")
          );
        }
      },

      /**
       * Event handler to check user input
       * @param {Event} oEvent control event
       * @public
       */
      onAlertDataLiveChange: function (oEvent) {
        var oView = this.getView(),
          oViewModel = this.getModel("detailView"),
          oValidation = oViewModel.getProperty("/validation"),
          oSource = oEvent.getSource(),
          oMsg = this.getResourceBundle(),
          sId = oSource.getId(),
          sValue = oSource.getValue(),
          sTitleInputId = oView.createId("detailsChangeTitleInput"),
          sTechNameInputId = oView.createId("detailsChangeTechNameInput"),
          sOrderInputId = oView.createId("detailsOrderOnCTInput"),
          sEmailToInputId = oView.createId("emailChangeToInput"),
          sEmailCCInputId = oView.createId("emailChangeCCInput"),
          sEmailBodyInputId = oView.createId("emailChangeBodyInput"),
          sTo = this.byId(sEmailToInputId).getValue(),
          sCC = this.byId(sEmailCCInputId).getValue();

        if (sId === sTitleInputId && sValue) {
          oValidation.TitleState = "None";
          oValidation.TitleStateText = "";
        }

        if (sId == sTechNameInputId && sValue) {
          oValidation.TechNameState = "None";
          oValidation.TechNameStateText = "";
        }

        if (sId === sOrderInputId && sValue) {
          oValidation.OrderState = "None";
          oValidation.OrderStateText = "";
        }

        // Check input and manage required flag visibility based on either to or org
        const validateEmail = (emails) => {
          const validOrg = (org) => org?.match?.(/^\#\d\d\d\d\d\d+$/);
          const validEmail = (email) =>
            email?.match?.(/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.[a-zA-Z]{2,3})+$/);
          const [email1, email2] = emails.split(";");
          const email = email1 || email2;
          return validEmail(email) || validOrg(email) ? true : false;
        };
        if (sId === sEmailToInputId) {
          if (sValue) {
            // reset input field state
            const isValidEmail = validateEmail(sValue);
            console.log({ isValidEmail });
            oValidation.EmailToState = "None";
            oValidation.EmailToStateText = "";
            oValidation.EmailOrgState = "None";
            oValidation.EmailOrgStateText = "";
            if (isValidEmail === false) {
              oValidation.EmailToState = "Error";
              oValidation.EmailToStateText = oMsg.getText(
                "emailToOrOrgrequiredField"
              );
            }
          }
        }

        if (sId === sEmailCCInputId) {
          if (sValue) {
            // reset input field state
            const isValidEmail = validateEmail(sValue);
            console.log({ isValidEmail });
            oValidation.EmailCCState = "None";
            oValidation.EmailCCStateText = "";
            if (isValidEmail === false) {
              oValidation.EmailCCState = "Error";
              oValidation.EmailCCStateText = oMsg.getText(
                "emailToOrOrgrequiredField"
              );
            }
          }
          if (sValue?.length === 0) {
            oValidation.EmailCCState = "None";
            oValidation.EmailCCStateText = "";
          }

          // manage required flag visibility
          oViewModel.setProperty("/emailToRequired", true);
        }

        if (sId === sEmailBodyInputId && sValue) {
          oValidation.EmailBodyState = "None";
          oValidation.EmailBodyStateText = "";
        }

        oViewModel.setProperty("/validation", oValidation);
      },

      /**
       * Validates the technical name of the BEx query against user input
       * @param {Event} oEvent control event
       * @private
       */
      onTechNameChange: function (oEvent) {
        var oView = this.getView(),
          oBinding = oView.getElementBinding(),
          oModel = oBinding.getModel(),
          oMsg = this.getResourceBundle(),
          oViewModel = this.getModel("detailView"),
          oValidation = oViewModel.getProperty("/validation"),
          oSource = oEvent.getSource(),
          oValue = oEvent.getParameters().value;

        // Check the source is BEx query
        if (!oViewModel.getProperty("/alertData/SourceText")?.includes("BW")) {
          oValidation.TechNameValid = true;
          oValidation.TechNameState = "None";
          oValidation.TechNameStateText = "";

          oViewModel.setProperty("/validation", oValidation);

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

          return;
        }

        // Check validity of BEx query
        oModel.callFunction("/CheckValidBExQuery", {
          urlParameters: {
            QueryName: oValue
          },
          success: function (oData) {
            oSource.setBusy(false);

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
            Log.error(oMsg.getText("validateBExFail", [oValue]));
          }
        });
      },

      /**
       * When alert not shown on CT, reset order to 0
       * @param {Event} oEvent control event
       * @public
       */
      onShowOnCTSelect: function (oEvent) {
        var oViewModel = this.getModel("detailView"),
          bSelected = oEvent.getParameters().selected;

        if (!bSelected) {
          oViewModel.setProperty("/alertData/OrderOnCT", "0");
        }
      },

      /**
       * Event handler to handle source, category and level selection change
       * @param {Event} oEvent control event
       * @public
       */
      onSelectChange: function (oEvent) {
        var oView = this.getView(),
          oViewModel = this.getModel("detailView"),
          oSelectedItem = oEvent.getParameters().selectedItem,
          sSelectId = oEvent.getSource().getId(),
          sText = oSelectedItem.getText(),
          sSourceId = oView.createId("detailsChangeSourceSelect"),
          sCategoryId = oView.createId("detailsChangeCategorySelect"),
          sLevelId = oView.createId("detailsChangeLevelSelect"),
          sDurationId = oView.createId("emailChangeDurationSelect");

        switch (sSelectId) {
          case sSourceId:
            if (oSelectedItem.getKey()) {
              oViewModel.setProperty("/validation/SourceState", "None");
              oViewModel.setProperty("/validation/SourceStateText", "");
            }
            try {
              const sTechNameInputValue = oView
                .byId("detailsChangeTechNameInput")
                .getValue();
              const xsjsFile = sTechNameInputValue.match(/\.xsjs/i);
              const sTechNameInput = oView.byId("detailsChangeTechNameInput");
              if (sText.includes("BW") && xsjsFile) {
                sTechNameInput?._$input?.focus?.();
                oViewModel.setProperty("/validation/TechNameState", "Error");
                oViewModel.setProperty(
                  "/validation/TechNameStateText",
                  "Inalid Bex Query"
                );
              }
              if (!sText.includes("BW")) {
                oViewModel.setProperty("/validation/TechNameState", "None");
                oViewModel.setProperty("/validation/TechNameStateText", "");
              }
            } catch (e) {
              console.log(e);
            }

            oViewModel.setProperty("/alertData/SourceText", sText);
            break;
          case sCategoryId:
            if (oSelectedItem.getKey()) {
              oViewModel.setProperty("/validation/CategoryState", "None");
              oViewModel.setProperty("/validation/CategoryStateText", "");
            }

            oViewModel.setProperty("/alertData/CategoryText", sText);
            // Reset page number also
            oViewModel.setProperty("/alertData/PageNo", "1");
            break;
          case sLevelId:
            oViewModel.setProperty("/alertData/CriticalityText", sText);
            break;
          case sDurationId:
            oViewModel.setProperty("/alertData/FrequencyText", sText);
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
          oViewModel = this.getModel("detailView"),
          oAlert = oViewModel.getProperty("/alertData"),
          sCategory = oAlert.Category,
          sPageNo = oAlert.PageNo;

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
            name: "com.aramco.ZSCM_CT_ALERT.fragment.OrderValueHelpDialog",
            controller: this
          }).then(
            function (oDialog) {
              oView.addDependent(oDialog);

              oDialog.addStyleClass(
                this.getOwnerComponent().getContentDensityClass()
              );

              oDialog.open();
            }.bind(this)
          );
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

      onViewAlertLog: function () {
        var oView = this.getView(),
          oElementBinding = oView.getElementBinding(),
          bReplace = !Device.system.phone;

        // No data for the binding
        if (!oElementBinding.getBoundContext()) {
          this.getRouter().getTargets().display("detailObjectNotFound");
          // if alert could not be found, the selection in the master list
          // does not make sense anymore.
          this.getOwnerComponent().oListSelector.clearMasterListSelection();
          return;
        }

        this.getRouter().navTo(
          "log",
          {
            alertId: oElementBinding.getBoundContext().getProperty("AlertId")
          },
          bReplace
        );
      },
      onInsertValue: function (oEvent, ar2) {
        console.log({ oEvent: oEvent.getId(), ar2 });
        const editor = this.byId("rteditor");
        window.omeditor = editor;
        const tinymce = editor?._oEditor;

        tinymce.insertContent(" {$value} ");
      },
      onEmailBodyRichEditorReady: function (oEvent) {
        const editor = this.byId("rteditor");
      },
      /* =========================================================== */
      /* begin: internal methods                                     */
      /* =========================================================== */

      /**
       * Binds the view to the alert path and expands the aggregated line items.
       * @function
       * @param {sap.ui.base.Event} oEvent pattern match event in route 'alert'
       * @private
       */
      _onObjectMatched: function (oEvent) {
        var sAlertId = oEvent.getParameter("arguments").alertId;
        this.getModel("appView").setProperty(
          "/layout",
          "TwoColumnsMidExpanded"
        );
        this.getModel()
          .metadataLoaded()
          .then(
            function () {
              var sAlertPath = this.getModel().createKey("Alerts", {
                AlertId: sAlertId
              });
              console.log({ sAlertPath });
              this._bindView("/" + sAlertPath);
            }.bind(this)
          );
      },

      /**
       * Binds the view to the alert path. Makes sure that detail view displays
       * a busy indicator while data for the corresponding element binding is loaded.
       * @function
       * @param {string} sAlertPath path to the alert to be bound to the view.
       * @private
       */
      _bindView: function (sAlertPath) {
        // Set busy indicator during view binding
        var oViewModel = this.getModel("detailView");

        // If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
        oViewModel.setProperty("/busy", false);

        this.getView().bindElement({
          path: sAlertPath,
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
          // if alert could not be found, the selection in the master list
          // does not make sense anymore.
          this.getOwnerComponent().oListSelector.clearMasterListSelection();
          return;
        }

        // Save the original bound alert data to local variable
        this._oBoundAlert = oView.getBindingContext().getObject();

        var sPath = oElementBinding.getPath();

        this.getOwnerComponent().oListSelector.selectAListItem(sPath);

        this._toggleEditMode(false);
        this.setAlertDataModel();
      },

      _onMetadataLoaded: function () {
        // Store original busy indicator delay for the detail view
        var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
          oViewModel = this.getModel("detailView");

        // Make sure busy indicator is displayed immediately when
        // detail view is displayed for the first time
        oViewModel.setProperty("/delay", 0);
        oViewModel.setProperty("/lineItemTableDelay", 0);

        // Binding the view will set it to not busy - so the view is always busy if it is not bound
        oViewModel.setProperty("/busy", true);
        // Restore original busy indicator delay for the detail view
        oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
      },

      setAlertDataModel: function () {
        var oViewModel = this.getView().getModel("detailView"),
          oAlert = {};

        var oValidation = {
          TitleState: "None",
          TitleStateText: "",
          SourceState: "None",
          SourceStateText: "",
          TechNameValid: true,
          TechNameState: "None",
          TechNameStateText: "",
          CategoryState: "None",
          CategoryStateText: "",
          OrderState: "None",
          OrderStateText: "",
          EmailToState: "None",
          EmailToStateText: "",
          EmailCCState: "None",
          EmailCCStateText: "",
          EmailBodyState: "None",
          EmailBodyStateText: ""
        };

        for (var property in this._oBoundAlert) {
          if (this._oBoundAlert.hasOwnProperty(property)) {
            oAlert[property] = this._oBoundAlert[property];
          }
        }

        // If email detail query is initial, copy the details query
        if (!oAlert.EmailDetail) {
          oAlert.EmailDetail = oAlert.Detail;
        }

        oViewModel.setProperty("/alertData", oAlert);
        oViewModel.setProperty("/validation", oValidation);

        oViewModel.setProperty("/emailToRequired", true);
      },

      /*
       * Toggles the view edit mode and changes the form fragment
       * @private
       * @param {bEdit} Is edit mode
       */
      _toggleEditMode: function (bEdit) {
        var oViewModel = this.getView().getModel("detailView");

        oViewModel.setProperty("/editMode", bEdit);

        this._showFormFragment(bEdit ? "Change" : "Display");
      },

      _getFormFragment: function (sFragmentName) {
        var pFormFragment = this._formFragments[sFragmentName],
          oView = this.getView();

        if (!pFormFragment) {
          pFormFragment = Fragment.load({
            id: oView.getId(),
            name: sFragmentName,
            controller: this
          });

          this._formFragments[sFragmentName] = pFormFragment;
        }

        return pFormFragment;
      },

      _showFormFragment: function (sFragmentName) {
      	debugger
        var oView = this.getView(),
          oDetailsFormBox = this.byId("detailsFormBox"),
          oEmailFormBox = this.byId("emailFormBox"),
                  oDataSource = this.byId("dataSource"),
          sDetailsForm =
            "com.aramco.ZSCM_CT_ALERT.fragment.Details" + sFragmentName,
          sEmailForm =
            "com.aramco.ZSCM_CT_ALERT.fragment.EmailConf" + sFragmentName,
           sDataSource =
            "com.aramco.ZSCM_CT_ALERT.fragment.DataSource" + sFragmentName ;

        oDetailsFormBox.removeAllItems();
        oEmailFormBox.removeAllItems();
        oDataSource.removeAllItems();
        // Insert details form
        this._getFormFragment(sDetailsForm).then(function (oForm) {
          oView.addDependent(oForm);
          oDetailsFormBox.insertItem(oForm);
        });

        // Insert email config form
        const that = this;
        this._getFormFragment(sEmailForm).then(function (oForm) {
          const editor = that.byId("rteditor");
          if (sEmailForm.includes("ConfChange")) {
            if (window?.cButton === undefined) {
              // insert custom button in the rich text editor
              const random = Math.random() * 100;
              const postId = random.toFixed();
              var oButton = new sap.m.Button(`myButton${postId}`, {
                text: "Alert Value",
                icon: "sap-icon://add",
                press: that.onInsertValue.bind(that)
              });
              window.cButton = oButton;
              editor.addCustomButton(oButton);
              sap.ui.getCore().applyChanges();
            }
          }
          oView.addDependent(oForm);
          oEmailFormBox.insertItem(oForm);
        });
        
        //insert data soure form
        this._getFormFragment(sDataSource).then(function (oForm) {
          oView.addDependent(oForm);
          oDataSource.insertItem(oForm);
        });
      },

      /**
       * Compares the user input with the bound alert data. If different, returns true
       * @private
       * @return {boolean} isChanged
       */
      alertDataChanged: function () {
        var oViewModel = this.getView().getModel("detailView"),
          oAlert = oViewModel.getProperty("/alertData");

        for (var property in oAlert) {
          if (oAlert.hasOwnProperty(property)) {
            if (oAlert[property] !== this._oBoundAlert[property]) {
              return true;
            }
          }
        }

        return false;
      },

      /**
       * Checks if the current order is not reserved for another alert or
       * exceeds maximum number of displayed alerts
       * @private
       */
      checkValidOrder: function () {
      	
        var oView = this.getView(),
          oBinding = oView.getElementBinding(),
          oModel = oBinding.getModel(),
          oViewModel = this.getModel("detailView"),
          oMsg = this.getResourceBundle(),
          oAlert = oViewModel.getProperty("/alertData"),
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
          if (!/^\d+$/.test(sOrder) || !parseFloat(sOrder)) {
            sMsg = oMsg.getText("orderOnCTZero");
            oViewModel.setProperty("/validation/OrderState", "Error");
            oViewModel.setProperty("/validation/OrderStateText", sMsg);
            return;
          }
        }

        oModel.callFunction("/CheckValidOrder", {
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
                oMsg.getText("orderReservedConfirm", [
                  oCheckOrder.CurrentAlert
                ]),
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
        });
      },

      validateAndSave: function () {
        var oView = this.getView(),
          oBinding = oView.getElementBinding(),
          oModel = oBinding.getModel(),
          oViewModel = this.getModel("detailView"),
          oAlertData = oViewModel.getProperty("/alertData"),
          oValidation = oViewModel.getProperty("/validation"),
          oMsg = this.getResourceBundle(),
          sPath = oBinding.getPath(),
          bValid = true;

        // Validate user input
        if (!oAlertData.Title) {
          oValidation.TitleState = "Error";
          oValidation.TitleStateText = oMsg.getText("requiredField");
          bValid = false;
        }

        if (!oAlertData.Source) {
          oValidation.SourceState = "Error";
          oValidation.SourceStateText = oMsg.getText("requiredField");
          bValid = false;
        }

        if (!oAlertData.TechnicalName) {
          oValidation.TechNameState = "Error";
          oValidation.TechNameStateText = oMsg.getText("requiredField");
          bValid = false;
        }

        if (!oValidation.TechNameValid) {
          bValid = false;
        }

        if (!oAlertData.Category) {
          oValidation.CategoryState = "Error";
          oValidation.CategoryStateText = oMsg.getText("requiredField");
          bValid = false;
        }

        if (oAlertData.ShowOnCT) {
          var sOrder = oAlertData.OrderOnCT;

          if (!/^\d+$/.test(sOrder) || !parseFloat(sOrder)) {
            oValidation.OrderState = "Error";
            oValidation.OrderStateText = oMsg.getText("orderOnCTZero");
            bValid = false;
          }
        }

        if (oAlertData.AutoEmail) {
          if (!oAlertData.EmailTo && !oAlertData.EmailOrg) {
            oValidation.EmailToState = "Error";
            oValidation.EmailToStateText = oMsg.getText(
              "emailToOrOrgrequiredField"
            );

            oValidation.EmailOrgState = "Error";
            oValidation.EmailOrgStateText = oMsg.getText(
              "emailToOrOrgrequiredField"
            );

            bValid = false;
          }

          if (!oAlertData.EmailBody) {
            oValidation.EmailBodyState = "Error";
            oValidation.EmailBodyStateText = oMsg.getText("requiredField");
            bValid = false;
          }
        }

        // if not valid, stop processing new alert
        if (!bValid) {
          oViewModel.setProperty("/validation", oValidation);

          MessageToast.show(oMsg.getText("detailValidationFail"), {
            width: "40%"
          });

          return;
        }

        oViewModel.setProperty("/busy", true);
        oModel.update(sPath, oAlertData, {
          success: function (oData) {
            oViewModel.setProperty("/busy", false);
            this._toggleEditMode(false);

            MessageToast.show(oMsg.getText("detailUpdateSuccess"), {
              width: "40%"
            });
          }.bind(this),

          error: function (oError) {
            oViewModel.setProperty("/busy", false);

            MessageToast.show(oMsg.getText("detailUpdateFail"), {
              width: "40%"
            });
          }
        });
      }
    });
  }
);
