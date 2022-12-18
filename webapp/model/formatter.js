sap.ui.define([], function () {
  "use strict";

  return {
    /**
     * Rounds the currency value to 2 digits
     *
     * @public
     * @param {string} sValue value to be formatted
     * @returns {string} formatted currency value with 2 digits
     */
    currencyValue: function (sValue) {
      if (!sValue) {
        return "";
      }

      return parseFloat(sValue).toFixed(2);
    },

    /**
     * Returns given date in mm/dd/yyyy format
     *
     * @public
     * @param {Date} oDate date to be formatted
     * @returns {string} formatted date
     */
    formatDate: function (oDate) {
      var formattedDate = oDate || new Date(),
        oFormat = sap.ui.core.format.DateFormat.getDateInstance({
          pattern: "MM/dd/yyyy"
        });

      return oFormat.format(formattedDate);
    },

    /**
     * Returns the proper icon for alert level of criticality
     *
     * @public
     * @param {string} sStatus status on which icon will be determined
     * @returns {string} icon path
     */
    alertStatusIcon: function (sStatus) {
      if (sStatus === "C") {
        return "sap-icon://alert";
      } else if (sStatus === "W") {
        return "sap-icon://message-warning";
      } else {
        return "sap-icon://warning2";
      }
    },

    /**
     * Returns the proper value state for alert level of criticality
     *
     * @public
     * @param {string} sStatus status on which state will be determined
     * @returns {string} value state
     */
    alertState: function (sStatus) {
      if (sStatus === "C") {
        return "Error";
      } else if (sStatus === "W") {
        return "Warning";
      } else {
        return "None";
      }
    },

    /**
     * Returns a formatted number with comma between each 3 digits
     *
     * @public
     * @param {string} sNumber number to be formatted
     * @returns {string} formatted number
     */
    withComma: function (sNumber) {
      if (isNaN(sNumber)) {
        return 0;
      }

      var parts = parseFloat(sNumber).toString().split(".");

      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

      return parts.join(".");
    },
    lastLogin: function (username, lastLoginDate, lastLoginTime) {
      console.log({ username, lastLoginDate, lastLoginTime });
      if (!lastLoginDate) return;
      if (!lastLoginTime) return;
      const threeHoursInMs = 1000 * 60 * 60 * 3;
      const timeAndDate = lastLoginDate?.setTime?.(
        Date.parse(lastLoginDate) + lastLoginTime.ms - threeHoursInMs
      );
      const formattedLastLogin = lastLoginDate?.toLocaleDateString?.("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric"
      });
      return `${username} —  Last Login: ${formattedLastLogin || ""}`;
    },
    /**
     * Returns a short format number
     *
     * @public
     * @param {string} sNumber number to be formatted
     * @param {string} iDigits number of floating point decimals
     * @param {boolean} bMM million format is MM
     * @returns {string} formatted number
     */
    formatNumber: function (sNumber, iDigits, bMM) {
      if (isNaN(sNumber)) {
        return 0;
      }

      var sNum = Math.abs(Number(sNumber)),
        iDig = iDigits ? iDigits : 0;

      if (sNum >= 1.0e9) {
        return (sNum / 1.0e9).toFixed(iDig) + "B";
      } else if (sNum >= 1.0e6) {
        return (sNum / 1.0e6).toFixed(iDig) + (bMM ? "MM" : "M");
      } else if (sNum >= 1.0e3) {
        return (sNum / 1.0e3).toFixed(iDig) + (bMM ? "M" : "K");
      } else {
        return sNum.toFixed(iDig);
      }
    },

    emailStatusIcon: function (sStatus) {
      var sIcon = "";

      switch (sStatus) {
        case "S":
          sIcon = "sap-icon://accept";
          break;
        case "E":
          sIcon = "sap-icon://status-negative";
          break;
        default:
          break;
      }

      return sIcon;
    },

    emailStatusState: function (sStatus) {
      var sState = "";

      switch (sStatus) {
        case "S":
          sState = "Success";
          break;
        case "E":
          sState = "Error";
          break;
        default:
          break;
      }

      return sState;
    },

    emailStatusText: function (sStatus) {
      var sText = "";

      switch (sStatus) {
        case "S":
          sText = "Success";
          break;
        case "E":
          sText = "Error";
          break;
        default:
          break;
      }

      return sText;
    },

    deleteLeadingZero: function (sNumber) {
      if (sNumber) {
        return String(sNumber).replace(/\b0+/, "");
      }

      return sNumber;
    }
  };
});
