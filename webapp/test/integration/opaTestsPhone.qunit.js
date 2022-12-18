/* global QUnit */

QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function() {
	"use strict";

	sap.ui.require([
		"com/aramco/ZSCM_CT_COMPONENT/test/integration/PhoneJourneys"
	], function() {
		QUnit.start();
	});
});