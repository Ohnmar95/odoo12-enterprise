odoo.define('web_cohort.CohortModel', function (require) {
'use strict';

var AbstractModel = require('web.AbstractModel');

var CohortModel = AbstractModel.extend({
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
    * @override
    * @returns {Object}
    */
    get: function () {
      return this.data;
    },
    /**
     * @override
     * @param {Object} params
     * @param {string} params.modelName
     * @param {string} params.dateStart
     * @param {string} params.dateStop
     * @param {string} params.measure
     * @param {string} params.interval
     * @param {Array[]} params.domain
     * @param {string} params.mode
     * @param {string} params.timeline
     * @returns {Deferred}
     */
    load: function (params) {
        this.modelName = params.modelName;
        this.dateStart = params.dateStart;
        this.dateStop = params.dateStop;
        this.measure = params.measure;
        this.interval = params.interval;
        this.domain = params.domain;
        this.timeRange = params.timeRange || [];
        this.comparisonTimeRange = params.comparisonTimeRange || [];
        this.compare =  params.compare;
        this.mode = params.mode;
        this.timeline = params.timeline;
        this.data = {
            measure: this.measure,
            interval: this.interval,
        };
        return this._fetchData();
    },
    /**
     * Reload data.
     *
     * @param {any} handle
     * @param {Object} params
     * @param {string} params.measure
     * @param {string} params.interval
     * @param {Array[]} params.domain
     * @param {Object} params.timeRangeMenuData
     * @returns {Deferred}
     */
    reload: function (handle, params) {
        if (params.context !== undefined) {
            var timeRangeMenuData = params.context.timeRangeMenuData;
            if (timeRangeMenuData) {
                this.timeRange = timeRangeMenuData.timeRange || [];
                this.comparisonTimeRange = timeRangeMenuData.comparisonTimeRange || [];
                this.compare =  this.comparisonTimeRange.length > 0;
            } else {
                this.timeRange = [];
                this.comparisonTimeRange = [];
                this.compare = false;
            }
        }
        if ('measure' in params) {
            this.data.measure = params.measure;
        }
        if ('interval' in params) {
            this.data.interval = params.interval;
        }
        if ('domain' in params) {
            this.domain = params.domain;
        }
        return this._fetchData();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Fetch cohort data.
     *
     * @private
     * @returns {Deferred}
     */
    _fetchData: function () {
        var self = this;
        var defs = [
            this._rpc({
                model: this.modelName,
                method: 'get_cohort_data',
                kwargs: {
                    date_start: this.dateStart,
                    date_stop: this.dateStop,
                    measure: this.data.measure,
                    interval: this.data.interval,
                    domain: this.domain.concat(this.timeRange),
                    mode: this.mode,
                    timeline: this.timeline,
                }
            })];
        if (this.compare) {
            defs.push(this._rpc({
                    model: this.modelName,
                    method: 'get_cohort_data',
                    kwargs: {
                        date_start: this.dateStart,
                        date_stop: this.dateStop,
                        measure: this.data.measure,
                        interval: this.data.interval,
                        domain: this.domain.concat(this.comparisonTimeRange),
                        mode: this.mode,
                        timeline: this.timeline,
                    }
                })
            );
        }
        return $.when.apply($, defs).then(function () {
            var results = Array.prototype.slice.call(arguments);
            self.data.report = results[0];
            if (self.compare) {
                self.data.comparisonReport = results[1];
            } else {
                self.data.comparisonReport = undefined;
            }
        });
    },
});

return CohortModel;

});
