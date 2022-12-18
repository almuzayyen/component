sap.ui.define([
  "./BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox"
], function (BaseController, JSONModel, Storage, MessageBox) {
  "use strict";

  return BaseController.extend(
    "com.aramco.ZSCM_CT_COMPONENT.controller.App", {

      onInit: function () {
        var oViewModel,
            fnSetAppNotBusy,
            iOriginalBusyDelay = this.getView()
              .getBusyIndicatorDelay();

        oViewModel = new JSONModel({
          busy: true,
          delay: 0,
          layout: "OneColumn",
          previousLayout: "",
          actionButtonsInfo: {
            midColumn: {
              fullScreen: false
            }
          }
        });
        this.setModel(oViewModel, "appView");

        fnSetAppNotBusy = function () {
          oViewModel.setProperty("/busy", false);
          oViewModel.setProperty("/delay",
            iOriginalBusyDelay);
        };

        // since then() has no "reject"-path attach to the MetadataFailed-Event to disable the busy indicator in case of an error
        this.getOwnerComponent()
          .getModel()
          .metadataLoaded()
          .then(fnSetAppNotBusy);
        this.getOwnerComponent()
          .getModel()
          .attachMetadataFailed(fnSetAppNotBusy);

        // apply content density mode to root view
        this.getView()
          .addStyleClass(this.getOwnerComponent()
            .getContentDensityClass());
      }
    });
});