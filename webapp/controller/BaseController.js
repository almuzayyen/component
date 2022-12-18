sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History",
  "sap/base/Log"
], function (Controller, History, Log) {
  "use strict";

  return Controller.extend(
    "com.aramco.ZSCM_CT_COMPONENT.controller.BaseController", {
      /**
       * Convenience method for accessing the router in every controller of the application.
       * @public
       * @returns {sap.ui.core.routing.Router} the router for this component
       */
      getRouter: function () {
        return this.getOwnerComponent()
          .getRouter();
      },

      /**
       * Convenience method for getting the view model by name in every controller of the application.
       * @public
       * @param {string} sName the model name
       * @returns {sap.ui.model.Model} the model instance
       */
      getModel: function (sName) {
        return this.getView()
          .getModel(sName);
      },

      /**
       * Convenience method for setting the view model in every controller of the application.
       * @public
       * @param {sap.ui.model.Model} oModel the model instance
       * @param {string} sName the model name
       * @returns {sap.ui.mvc.View} the view instance
       */
      setModel: function (oModel, sName) {
        return this.getView()
          .setModel(oModel, sName);
      },

      /**
       * Convenience method for getting the resource bundle.
       * @public
       * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
       */
      getResourceBundle: function () {
        return this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle();
      },

      /**
       * Event handler for navigating back.
       * It there is a history entry we go one step back in the browser history
       * If not, it will replace the current entry of the browser history with the master route.
       * @public
       */
      onNavBack: function () {
        var sPreviousHash = History.getInstance()
          .getPreviousHash();

        if (sPreviousHash !== undefined) {
          // eslint-disable-next-line sap-no-history-manipulation
          history.go(-1);
        } else {
          this.getRouter()
            .navTo("master", {}, true);
        }
      },

      getServiceURI: function () {
        return this.getOwnerComponent()
          .getManifestEntry("sap.app")
          .dataSources.mainService.uri;
      },

      /**
       * Convenience method for setting the 'Cross-Site Request Forgery' token
       * CSRF token check is a way to provide security for the already authenticated user
       * Once we request for X-CSRF token, we get that in header and we save in model for future use
       * @public
       */
      readCSRFToken: function () {
        var sHost = window.location.origin,
            sService = this.getServiceURI(),
            sUrl = sHost + sService;
        $.ajax({
          type: "GET",
          url: sUrl,
          dataType: "json",
          headers: {
            "Content-Type": "application/atom+xml",
            "Accept": "application/json",
            "DataServiceVersion": "2.0",
            "X-Requested-With": "XMLHttpRequest",
            "X-CSRF-Token": "Fetch"
          },

          success: function (oData, oResponse, oXhr) {
            this.getModel("appView")
              .setProperty("/CSRFToken", oXhr.getResponseHeader(
                "x-csrf-token"));
          }.bind(this),

          error: function (sError) {
            Log.error(sError);
          }
        });
      }

    });

});