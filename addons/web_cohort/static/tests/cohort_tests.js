odoo.define('web_cohort.cohort_tests', function (require) {
'use strict';

var CohortView = require('web_cohort.CohortView');
var testUtils = require('web.test_utils');

var createView = testUtils.createView;
var createActionManager = testUtils.createActionManager;
var patchDate = testUtils.patchDate;

QUnit.module('Views', {
    beforeEach: function () {
        this.data = {
            subscription: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    start: {string: 'Start', type: 'date', sortable: true},
                    stop: {string: 'Stop', type: 'date', sortable: true},
                    recurring: {string: 'Recurring Price', type: 'integer', store: true},
                },
                records: [
                    {id: 1, start: '2017-07-12', stop: '2017-08-11', recurring: 10},
                    {id: 2, start: '2017-08-14', stop: '', recurring: 20},
                    {id: 3, start: '2017-08-21', stop: '2017-08-29', recurring: 10},
                    {id: 4, start: '2017-08-21', stop: '', recurring: 20},
                    {id: 5, start: '2017-08-23', stop: '', recurring: 10},
                    {id: 6, start: '2017-08-24', stop: '', recurring: 22},
                    {id: 7, start: '2017-08-24', stop: '2017-08-29', recurring: 10},
                    {id: 8, start: '2017-08-24', stop: '', recurring: 22},
                ]
            },
            lead: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    start: {string: 'Start', type: 'date'},
                    stop: {string: 'Stop', type: 'date'},
                    revenue: {string: 'Revenue', type: 'float', store: true},
                },
                records: [
                    {id: 1, start: '2017-07-12', stop: '2017-08-11', revenue: 1200.20},
                    {id: 2, start: '2017-08-14', stop: '', revenue: 500},
                    {id: 3, start: '2017-08-21', stop: '2017-08-29', revenue: 5599.99},
                    {id: 4, start: '2017-08-21', stop: '', revenue: 13500},
                    {id: 5, start: '2017-08-23', stop: '', revenue: 6000},
                    {id: 6, start: '2017-08-24', stop: '', revenue: 1499.99},
                    {id: 7, start: '2017-08-24', stop: '2017-08-29', revenue: 16000},
                    {id: 8, start: '2017-08-24', stop: '', revenue: 22000},
                ]
            },
            attendee: {
                fields: {
                    id: {string: 'ID', type: 'integer'},
                    event_begin_date: {string: 'Event Start Date', type: 'date'},
                    registration_date: {string: 'Registration Date', type: 'date'},
                },
                records: [
                    {id: 1, event_begin_date: '2018-06-30', registration_date: '2018-06-13'},
                    {id: 2, event_begin_date: '2018-06-30', registration_date: '2018-06-20'},
                    {id: 3, event_begin_date: '2018-06-30', registration_date: '2018-06-22'},
                    {id: 4, event_begin_date: '2018-06-30', registration_date: '2018-06-22'},
                    {id: 5, event_begin_date: '2018-06-30', registration_date: '2018-06-29'},
                ]
            },
        };
    }
}, function () {
    QUnit.module('CohortView');

    QUnit.test('simple cohort rendering', function (assert) {
        assert.expect(7);

        var cohort = createView({
            View: CohortView,
            model: 'subscription',
            data: this.data,
            arch: '<cohort string="Subscription" date_start="start" date_stop="stop" />'
        });

        assert.strictEqual(cohort.$('.table').length, 1,
            'should have a table');
        assert.ok(cohort.$('.table thead tr:first th:first:contains(Start)').length,
            'should contain "Start" in header of first column');
        assert.ok(cohort.$('.table thead tr:first th:nth-child(3):contains(Stop - By Day)').length,
            'should contain "Stop - By Day" in title');
        assert.ok(cohort.$('.table thead tr:nth-child(2) th:first:contains(+0)').length,
            'interval should start with 0');
        assert.ok(cohort.$('.table thead tr:nth-child(2) th:nth-child(16):contains(+15)').length,
            'interval should end with 15');

        assert.strictEqual(cohort.$buttons.find('.o_cohort_measures_list').length, 1,
            'should have list of measures');
        assert.strictEqual(cohort.$buttons.find('.o_cohort_interval_button').length, 4,
            'should have buttons of intervals');

        cohort.destroy();
    });

    QUnit.test('correctly set by default measure and interval', function (assert) {
        assert.expect(4);

        var cohort = createView({
            View: CohortView,
            model: 'subscription',
            data: this.data,
            arch: '<cohort string="Subscription" date_start="start" date_stop="stop" />'
        });

        assert.ok(cohort.$buttons.find('.o_cohort_measures_list [data-field=__count__]').hasClass('selected'),
                'count should by default for measure');
        assert.ok(cohort.$buttons.find('.o_cohort_interval_button[data-interval=day]').hasClass('active'),
                'day should by default for interval');

        assert.ok(cohort.$('.table thead tr:first th:nth-child(2):contains(Count)').length,
            'should contain "Count" in header of second column');
        assert.ok(cohort.$('.table thead tr:first th:nth-child(3):contains(Stop - By Day)').length,
            'should contain "Stop - By Day" in title');

        cohort.destroy();
    });

    QUnit.test('correctly sort measure items', function (assert) {
        assert.expect(3);

        var data = this.data;
        // It's important to compare capitalized and lowercased words
        // to be sure the sorting is effective with both of them
        data.subscription.fields.flop = {string: 'Abc', type: 'integer', store: true};
        data.subscription.fields.add = {string: 'add', type: 'integer', store: true};
        data.subscription.fields.zoo = {string: 'Zoo', type: 'integer', store: true};

        var cohort = createView({
            View: CohortView,
            model: 'subscription',
            data: this.data,
            arch: '<cohort string="Subscription" date_start="start" date_stop="stop"/>',
        });

        assert.strictEqual( $('.o_cohort_measures_list>button:first-child').html().trim(), 'Abc', 'should begin with the first alphabetical value');
        assert.strictEqual( $('.o_cohort_measures_list>button:nth-child(4)').html().trim(), 'Zoo', 'should end with the last alphabetical value');
        assert.strictEqual( $('.o_cohort_measures_list>button:last-child').html(), 'Count', '\'Count\' should be always the last item');

        cohort.destroy();
    });

    QUnit.test('correctly set measure and interval after changed', function (assert) {
        assert.expect(8);

        var cohort = createView({
            View: CohortView,
            model: 'subscription',
            data: this.data,
            arch: '<cohort string="Subscription" date_start="start" date_stop="stop" measure="recurring" interval="week" />'
        });

        assert.ok(cohort.$buttons.find('.o_cohort_measures_list [data-field=recurring]').hasClass('selected'),
                'should recurring for measure');
        assert.ok(cohort.$buttons.find('.o_cohort_interval_button[data-interval=week]').hasClass('active'),
                'should week for interval');

        assert.ok(cohort.$('.table thead tr:first th:nth-child(2):contains(Recurring Price)').length,
            'should contain "Recurring Price" in header of second column');
        assert.ok(cohort.$('.table thead tr:first th:nth-child(3):contains(Stop - By Week)').length,
            'should contain "Stop - By Week" in title');

        cohort.$buttons.find('.o_cohort_measures_list [data-field=__count__]').click();
        assert.ok(cohort.$buttons.find('.o_cohort_measures_list [data-field=__count__]').hasClass('selected'),
                'should active count for measure');
        assert.ok(cohort.$('.table thead tr:first th:nth-child(2):contains(Count)').length,
            'should contain "Count" in header of second column');

        cohort.$buttons.find('.o_cohort_interval_button[data-interval=month]').click();
        assert.ok(cohort.$buttons.find('.o_cohort_interval_button[data-interval=month]').hasClass('active'),
                'should active month for interval');
        assert.ok(cohort.$('.table thead tr:first th:nth-child(3):contains(Stop - By Month)').length,
            'should contain "Stop - By Month" in title');

        cohort.destroy();
    });

    QUnit.test('when clicked on cell redirects to the correct list/form view ', function(assert) {
        assert.expect(6);

        var actionManager = createActionManager({
            data: this.data,
            archs: {
                'subscription,false,cohort': '<cohort string="Subscriptions" date_start="start" date_stop="stop" measure="__count__" interval="week" />',
                'subscription,my_list_view,list': '<tree>' +
                        '<field name="start"/>' +
                        '<field name="stop"/>' +
                    '</tree>',
                'subscription,my_form_view,form': '<form>' +
                        '<field name="start"/>' +
                        '<field name="stop"/>' +
                    '</form>',
                'subscription,false,list': '<tree>' +
                        '<field name="recurring"/>' +
                        '<field name="start"/>' +
                    '</tree>',
                'subscription,false,form': '<form>' +
                        '<field name="recurring"/>' +
                        '<field name="start"/>' +
                    '</form>',
                'subscription,false,search': '<search></search>',
            },
            intercepts: {
                do_action: function (ev) {
                    actionManager.doAction(ev.data.action, ev.data.options);
                },
            },
        });

        actionManager.doAction({
            name: 'Subscriptions',
            res_model: 'subscription',
            type: 'ir.actions.act_window',
            views: [[false, 'cohort'], ['my_list_view', 'list'], ['my_form_view', 'form']],
        });

        // Going to the list view, while clicking Period / Count cell
        actionManager.$('td.o_cohort_value:first').click();
        assert.strictEqual(actionManager.$('.o_list_view th:nth(1)').text(), 'Start',
                "First field in the list view should be start");
        assert.strictEqual(actionManager.$('.o_list_view th:nth(2)').text(), 'Stop',
                "Second field in the list view should be stop");

        // Going to the list view
        actionManager.$('td div.o_cohort_value:first').click();

        assert.strictEqual(actionManager.$('.o_list_view th:nth(1)').text(), 'Start',
                "First field in the list view should be start");
        assert.strictEqual(actionManager.$('.o_list_view th:nth(2)').text(), 'Stop',
                "Second field in the list view should be stop");

        // Going to the form view
        actionManager.$('.o_list_view .o_data_row').click();

        assert.strictEqual(actionManager.$('.o_form_view span:first').attr('name'), 'start',
                "First field in the form view should be start");
        assert.strictEqual(actionManager.$('.o_form_view span:nth(1)').attr('name'), 'stop',
                "Second field in the form view should be stop");

        actionManager.destroy();
    });


    QUnit.test('test mode churn', function(assert) {
        assert.expect(3);

        var cohort = createView({
            View: CohortView,
            model: 'lead',
            data: this.data,
            arch: '<cohort string="Leads" date_start="start" date_stop="stop" interval="week" mode="churn" />',
            mockRPC: function(route, args) {
                assert.strictEqual(args.kwargs.mode, "churn", "churn mode should be sent via RPC");
                return this._super(route, args);
            },
        });

        assert.strictEqual(cohort.$('td .o_cohort_value:first').text().trim(), '0.0%', 'first col should display 0 percent');
        assert.strictEqual(cohort.$('td .o_cohort_value:nth(4)').text().trim(), '100.0%', 'col 5 should display 100 percent');

        cohort.destroy();
    });

    QUnit.test('test backward timeline', function (assert) {
        assert.expect(7);

        var cohort = createView({
            View: CohortView,
            model: 'attendee',
            data: this.data,
            arch: '<cohort string="Attendees" date_start="event_begin_date" date_stop="registration_date" interval="day" timeline="backward" mode="churn"/>',
            mockRPC: function (route, args) {
                assert.strictEqual(args.kwargs.timeline, "backward", "backward timeline should be sent via RPC");
                return this._super(route, args);
            },
        });

        assert.ok(cohort.$('.table thead tr:nth-child(2) th:first:contains(-15)').length,
            'interval should start with -15');
        assert.ok(cohort.$('.table thead tr:nth-child(2) th:nth-child(16):contains(0)').length,
            'interval should end with 0');
        assert.strictEqual(cohort.$('td .o_cohort_value:first').text().trim(), '20.0%', 'first col should display 20 percent');
        assert.strictEqual(cohort.$('td .o_cohort_value:nth(5)').text().trim(), '40.0%', 'col 6 should display 40 percent');
        assert.strictEqual(cohort.$('td .o_cohort_value:nth(7)').text().trim(), '80.0%', 'col 8 should display 80 percent');
        assert.strictEqual(cohort.$('td .o_cohort_value:nth(14)').text().trim(), '100.0%', 'col 15 should display 100 percent');

        cohort.destroy();
    });

    QUnit.test('when clicked on cell redirects to the action list/form view passed in context', function(assert) {
        assert.expect(6);

        var actionManager = createActionManager({
            data: this.data,
            archs: {
                'subscription,false,cohort': '<cohort string="Subscriptions" date_start="start" date_stop="stop" measure="__count__" interval="week" />',
                'subscription,my_list_view,list': '<tree>' +
                        '<field name="start"/>' +
                        '<field name="stop"/>' +
                    '</tree>',
                'subscription,my_form_view,form': '<form>' +
                        '<field name="start"/>' +
                        '<field name="stop"/>' +
                    '</form>',
                'subscription,false,list': '<tree>' +
                    '<field name="recurring"/>' +
                    '<field name="start"/>' +
                    '</tree>',
                'subscription,false,form': '<form>' +
                        '<field name="recurring"/>' +
                        '<field name="start"/>' +
                    '</form>',
                'subscription,false,search': '<search></search>',
            },
            intercepts: {
                do_action: function (ev) {
                    actionManager.doAction(ev.data.action, ev.data.options);
                },
            },
        });

        actionManager.doAction({
            name: 'Subscriptions',
            res_model: 'subscription',
            type: 'ir.actions.act_window',
            views: [[false, 'cohort']],
            context: {list_view_id: 'my_list_view', form_view_id: 'my_form_view'},
        });

        // Going to the list view, while clicking Period / Count cell
        actionManager.$('td.o_cohort_value:first').click();
        assert.strictEqual(actionManager.$('.o_list_view th:nth(1)').text(), 'Start',
                "First field in the list view should be start");
        assert.strictEqual(actionManager.$('.o_list_view th:nth(2)').text(), 'Stop',
                "Second field in the list view should be stop");

        // Going to the list view
        actionManager.$('td div.o_cohort_value:first').click();

        assert.strictEqual(actionManager.$('.o_list_view th:nth(1)').text(), 'Start',
                "First field in the list view should be start");
        assert.strictEqual(actionManager.$('.o_list_view th:nth(2)').text(), 'Stop',
                "Second field in the list view should be stop");

        // Going to the form view
        actionManager.$('.o_list_view .o_data_row').click();

        assert.strictEqual(actionManager.$('.o_form_view span:first').attr('name'), 'start',
                "First field in the form view should be start");
        assert.strictEqual(actionManager.$('.o_form_view span:nth(1)').attr('name'), 'stop',
                "Second field in the form view should be stop");

        actionManager.destroy();
    });

    QUnit.test('rendering of a cohort view with comparison', function (assert) {
        assert.expect(27);

        var unpatchDate = patchDate(2017, 7, 25, 1, 0, 0);

        var actionManager = createActionManager({
            data: this.data,
            archs: {
                'subscription,false,cohort': '<cohort string="Subscriptions" date_start="start" date_stop="stop" measure="__count__" interval="week" />',
                'subscription,false,search': '<search></search>',
            },
            intercepts: {
                do_action: function (ev) {
                    actionManager.doAction(ev.data.action, ev.data.options);
                },
            },
        });

        actionManager.doAction({
            name: 'Subscriptions',
            res_model: 'subscription',
            type: 'ir.actions.act_window',
            views: [[false, 'cohort']],
        });

        function verifyContents (results) {
            var $tables = actionManager.$('table');
            assert.strictEqual($tables.length, results.length, 'There should be' + results.length + 'tables');
            var i=0;
            var result;
            $tables.each(function () {
                i++;
                result = results.shift();
                var $table = $(this);
                var rowCount = $table.find('.o_cohort_row_clickable').length;

                if (rowCount) {
                    assert.strictEqual(rowCount, result, 'the table should contain' + result + 'rows');
                } else {
                    assert.strictEqual($table.find('th:first').text().trim(), result,
                    'the table should contain the time range description' + result);
                }
            });
        }

        function verifyNoContentHelper (text) {
            if (text) {
                assert.strictEqual(actionManager.$('div.o_cohort_no_data').length, 1, "there should be a no content helper");
                assert.strictEqual(actionManager.$('div.o_cohort_no_data').text().trim(), text);
            } else {
                assert.strictEqual(actionManager.$('div.o_cohort_no_data').length, 0, "there should be no no content helper");
            }
        }

        // with no comparison, with data (no filter)

        verifyContents([3]);
        verifyNoContentHelper();

        // with no comparison with no data (filter on 'last_year')

        $('.o_time_range_menu_button').click();
        $('.o_time_range_selector').val('last_year');
        $('.o_time_range_menu .o_apply_range').click();

        verifyContents([]);
        verifyNoContentHelper("No data available for cohort.");


        // with comparison active, data and comparisonData (filter on 'this_month' + 'previous_period')
        $('.o_time_range_menu_button').click();
        $('.o_time_range_menu .o_comparison_checkbox').click();
        $('.o_time_range_selector').val('this_month');
        $('.o_time_range_menu .o_apply_range').click();

        verifyContents(['This Month', 2, 'Previous Period', 1]);
        verifyNoContentHelper();


        // with comparison active, data, no comparisonData (filter on 'this_year' + 'previous_period')

        $('.o_time_range_menu_button').click();
        $('.o_time_range_selector').val('this_year');
        $('.o_time_range_menu .o_apply_range').click();

        verifyContents(['This Year', 3, 'Previous Period']);
        verifyNoContentHelper("No data available.");

        // with comparison active, no data, comparisonData (filter on 'today' + 'previous_period')

        $('.o_time_range_menu_button').click();
        $('.o_time_range_selector').val('today');
        $('.o_time_range_menu .o_apply_range').click();

        verifyContents(['Today', 'Previous Period', 1]);
        verifyNoContentHelper("No data available.");

        // with comparison active, no data, no comparisonData (filter on 'last_year' + 'previous_period')

        $('.o_time_range_menu_button').click();
        $('.o_time_range_selector').val('last_year');
        $('.o_time_range_menu .o_apply_range').click();

        verifyContents([]);
        verifyNoContentHelper("No data available for cohort.");

        unpatchDate();
        actionManager.destroy();
    });

});
});
