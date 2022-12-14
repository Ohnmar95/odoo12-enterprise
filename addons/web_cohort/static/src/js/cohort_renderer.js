odoo.define('web_cohort.CohortRenderer', function (require) {
'use strict';

var AbstractRenderer = require('web.AbstractRenderer');
var core = require('web.core');

var qweb = core.qweb;

var CohortRenderer = AbstractRenderer.extend({
    events: _.extend({}, AbstractRenderer.prototype.events, {
        'click .o_cohort_row_clickable': '_onClickRow',
    }),
    /**
     * @override
     * @param {Widget} parent
     * @param {Object} state
     * @param {Object} params
     * @param {Object} params.measures
     * @param {Object} params.intervals
     * @param {string} params.dateStartString
     * @param {string} params.dateStopString
     * @param {string} params.mode
     * @param {string} params.timeline
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.measures = params.measures;
        this.intervals = params.intervals;
        this.dateStartString = params.dateStartString;
        this.dateStopString = params.dateStopString;
        this.timeRangeDescription = params.timeRangeDescription;
        this.comparisonTimeRangeDescription = params.comparisonTimeRangeDescription;
        this.mode = params.mode;
        this.timeline = params.timeline;
    },
    /**
     * @override
     * @param {Object} state
     * @param {Object} params
     */
    updateState: function (state, params) {
        if (params.context !== undefined) {
            var timeRangeMenuData = params.context.timeRangeMenuData;
            if (timeRangeMenuData) {
                this.timeRangeDescription = timeRangeMenuData.timeRangeDescription;
                this.comparisonTimeRangeDescription = timeRangeMenuData.comparisonTimeRangeDescription;
            } else {
                this.timeRangeDescription = undefined;
                this.comparisonTimeRangeDescription = undefined;
            }
        }
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     * @returns {Deferred}
     */
    _render: function () {
        var self = this;
        this.$el.empty().append(qweb.render('CohortView', {
            report: this.state.report,
            comparisonReport: this.state.comparisonReport,
            measure: this.measures[this.state.measure],
            interval: this.intervals[this.state.interval],
            date_start_string: this.dateStartString,
            date_stop_string: this.dateStopString,
            timeRangeDescription: this.timeRangeDescription,
            comparisonTimeRangeDescription: this.comparisonTimeRangeDescription,
            mode: this.mode,
            timeline: this.timeline,
        }));
        this.$('.o_cohort_highlight.o_cohort_value').tooltip({
            title: function () {
                var $cell = $(this);
                return qweb.render('CohortView.tooltip', {
                    period: $cell.data('period'),
                    count: $cell.data('count'),
                    measure: self.measures[self.state.measure],
                });
            },
        });
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} event
     */
    _onClickRow: function (event) {
        if (!$(event.target).hasClass('o_cohort_value')) {
            return;
        }
        var rowData = $(event.currentTarget).data();
        var rowIndex = rowData.row;
        var colIndex = $(event.target).data().col;
        var row = (rowData.type === 'data') ?
                    this.state.report.rows[rowIndex] :
                    this.state.comparisonReport.rows[rowIndex];
        var rowDomain = row ? row.domain : [];
        var cellContent = row ? row.columns[colIndex] : false;
        var cellDomain = cellContent ? cellContent.domain : [];

        var fullDomain = rowDomain.concat(cellDomain);
        if (cellDomain.length) {
            fullDomain.unshift('&', '&');
        }
        if (fullDomain.length) {
            this.trigger_up('row_clicked', {domain: fullDomain});
        }
    },
});

return CohortRenderer;

});
