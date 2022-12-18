/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"com/aramco/ZSCM_CT_COMPONENT/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});