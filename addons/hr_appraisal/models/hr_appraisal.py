# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.


from odoo import api, fields, models, _
from odoo.exceptions import UserError


class HrAppraisal(models.Model):
    _name = "hr.appraisal"
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _description = "Employee Appraisal"
    _order = 'date_close, date_final_interview'
    _rec_name = 'employee_id'

    APPRAISAL_STATES = [
        ('new', 'To Start'),
        ('pending', 'Appraisal Sent'),
        ('done', 'Done'),
        ('cancel', "Cancelled"),
    ]

    active = fields.Boolean(default=True)
    action_plan = fields.Text(string="Action Plan", help="If the evaluation does not meet the expectations, you can propose an action plan")
    company_id = fields.Many2one('res.company', string='Company', default=lambda self: self.env.user.company_id)
    color = fields.Integer(string='Color Index', help='This color will be used in the kanban view.')
    employee_id = fields.Many2one('hr.employee', required=True, string='Employee', index=True)
    department_id = fields.Many2one('hr.department', related='employee_id.department_id', string='Department', store=True, readonly=True)
    date_close = fields.Date(string='Appraisal Deadline', required=True)
    state = fields.Selection(APPRAISAL_STATES, string='Status', track_visibility='onchange', required=True, copy=False, default='new', index=True)
    manager_appraisal = fields.Boolean(string='Appraisal by Manager', help="This employee will be appraised by his managers")
    manager_ids = fields.Many2many('hr.employee', 'appraisal_manager_rel', 'hr_appraisal_id')
    manager_survey_id = fields.Many2one('survey.survey', string="Manager's Appraisal")
    collaborators_appraisal = fields.Boolean(string='Collaborator', help="This employee will be appraised by his collaborators")
    collaborators_ids = fields.Many2many('hr.employee', 'appraisal_subordinates_rel', 'hr_appraisal_id')
    collaborators_survey_id = fields.Many2one('survey.survey', string="Collaborator's Appraisal")
    colleagues_appraisal = fields.Boolean(string='Colleagues Appraisal', help="This employee will be appraised by his colleagues")
    colleagues_ids = fields.Many2many('hr.employee', 'appraisal_colleagues_rel', 'hr_appraisal_id', string="Colleagues")
    colleagues_survey_id = fields.Many2one('survey.survey', string="Colleague's Appraisal")
    employee_appraisal = fields.Boolean(help="This employee will do a self-appraisal")
    employee_survey_id = fields.Many2one('survey.survey', string='Self Appraisal')
    survey_sent_ids = fields.One2many('survey.user_input', 'appraisal_id', string='Sent Forms')
    count_sent_survey = fields.Integer(string="Number of Sent Forms", compute='_compute_sent_survey')
    survey_completed_ids = fields.One2many('survey.user_input', 'appraisal_id', string='Answers', domain=lambda self: [('state', '=', 'done')])
    count_completed_survey = fields.Integer(string="Number of Answers", compute='_compute_completed_survey')
    mail_template_id = fields.Many2one('mail.template', string="Email Template for Appraisal", default=lambda self: self.env.ref('hr_appraisal.send_appraisal_template'))
    meeting_id = fields.Many2one('calendar.event', string='Meeting')
    date_final_interview = fields.Date(string="Final Interview", index=True, track_visibility='onchange')

    @api.multi
    def _compute_sent_survey(self):
        survey_sent = self.env['survey.user_input'].read_group([('appraisal_id', 'in', self.ids)], ['appraisal_id'], ['appraisal_id'])
        result = dict((data['appraisal_id'][0], data['appraisal_id_count']) for data in survey_sent)
        for appraisal in self:
            appraisal.count_sent_survey = result.get(appraisal.id, 0)

    @api.multi
    def _compute_completed_survey(self):
        completed_survey = self.env['survey.user_input'].read_group([('appraisal_id', 'in', self.ids), ('state', '=', 'done')], ['appraisal_id'], ['appraisal_id'])
        result = dict((data['appraisal_id'][0], data['appraisal_id_count']) for data in completed_survey)
        for appraisal in self:
            appraisal.count_completed_survey = result.get(appraisal.id, 0)

    @api.onchange('employee_id')
    def onchange_employee_id(self):
        if self.employee_id:
            self.department_id = self.employee_id.department_id
            self.manager_appraisal = self.employee_id.appraisal_by_manager
            self.manager_ids = self.employee_id.appraisal_manager_ids
            self.manager_survey_id = self.employee_id.appraisal_manager_survey_id
            self.colleagues_appraisal = self.employee_id.appraisal_by_colleagues
            self.colleagues_ids = self.employee_id.appraisal_colleagues_ids
            self.colleagues_survey_id = self.employee_id.appraisal_colleagues_survey_id
            self.employee_appraisal = self.employee_id.appraisal_self
            self.employee_survey_id = self.employee_id.appraisal_self_survey_id
            self.collaborators_appraisal = self.employee_id.appraisal_by_collaborators
            self.collaborators_ids = self.employee_id.appraisal_collaborators_ids
            self.collaborators_survey_id = self.employee_id.appraisal_collaborators_survey_id

    @api.multi
    def subscribe_employees(self):
        """
        Subscribes the employee and his manager to the appraisal thread.
        Also subscribes other employees designed as manager for this appraisal, and the manager of the employee's department if he's different from the employee's direct manager.
        """
        for appraisal in self:
            partner_ids = [emp.related_partner_id.id for emp in appraisal.manager_ids if emp.related_partner_id]

            if appraisal.employee_id.related_partner_id:
                partner_ids.append(appraisal.employee_id.related_partner_id.id)
            if appraisal.employee_id.parent_id.related_partner_id:
                partner_ids.append(appraisal.employee_id.parent_id.related_partner_id.id)
            if appraisal.employee_id.department_id.manager_id.related_partner_id:
                partner_ids.append(appraisal.employee_id.department_id.manager_id.related_partner_id.id)

            partner_ids = list(set(partner_ids))
            appraisal.message_subscribe(partner_ids=partner_ids)
        return True

    @api.multi
    def schedule_final_meeting(self, interview_deadline):
        """ Creates event when user enters date manually from the form view.
            If users edit the already entered date, created meeting is updated accordingly.
        """
        CalendarEvent = self.env['calendar.event']
        values = {'start': interview_deadline, 'stop': interview_deadline}
        for appraisal in self:
            if appraisal.meeting_id and appraisal.meeting_id.allday:
                appraisal.meeting_id.write(values)
                appraisal.activity_reschedule(['mail.mail_activity_data_meeting'], date_deadline=interview_deadline)
            elif appraisal.meeting_id and not appraisal.meeting_id.allday:
                date = fields.Date.from_string(interview_deadline)
                meeting_date = fields.Datetime.to_string(date)
                appraisal.meeting_id.write({'start_datetime': meeting_date, 'stop_datetime': meeting_date})
                appraisal.activity_reschedule(['mail.mail_activity_data_meeting'], date_deadline=interview_deadline)
            if not appraisal.meeting_id:
                employee_attendees = appraisal.manager_ids | appraisal.employee_id
                values['name'] = _('Appraisal Meeting For %s') % appraisal.employee_id.name
                values['allday'] = True
                values['partner_ids'] = [(4, partner.id) for partner in employee_attendees.mapped('related_partner_id')]
                user_ids = employee_attendees.mapped('user_id').ids or [self.env.uid]
                values['user_id'] = user_ids[0]
                # values['activity_ids'] = [(4, activity.id)]
                meeting = CalendarEvent.create(values)
                appraisal.activity_schedule(
                    'mail.mail_activity_data_meeting', interview_deadline,
                    note=_('<a href="#" data-oe-model="%s" data-oe-id="%s">Meeting</a> for <a href="#" data-oe-model="%s" data-oe-id="%s">%s\'s</a> appraisal') % (
                        meeting._name, meeting.id, appraisal.employee_id._name,
                        appraisal.employee_id.id, appraisal.employee_id.display_name),
                    user_id=user_ids[0],
                    calendar_event_id=meeting.id)
                appraisal.meeting_id = meeting.id
        return True

    def _prepare_user_input_receivers(self):
        """
        @return: returns a list of tuple (survey, list of employees).
        """
        appraisal_receiver = []
        if self.manager_appraisal and self.manager_ids and self.manager_survey_id:
            appraisal_receiver.append((self.manager_survey_id, self.manager_ids))
        if self.colleagues_appraisal and self.colleagues_ids and self.colleagues_survey_id:
            appraisal_receiver.append((self.colleagues_survey_id, self.colleagues_ids))
        if self.collaborators_appraisal and self.collaborators_ids and self.collaborators_survey_id:
            appraisal_receiver.append((self.collaborators_survey_id, self.collaborators_ids))
        if self.employee_appraisal and self.employee_survey_id:
            appraisal_receiver.append((self.employee_survey_id, self.employee_id))
        return appraisal_receiver

    @api.multi
    def send_appraisal(self):
        ComposeMessage = self.env['survey.mail.compose.message']
        for appraisal in self:
            appraisal_receiver = appraisal._prepare_user_input_receivers()
            for survey, receivers in appraisal_receiver:
                for employee in receivers:
                    email = employee.related_partner_id.email or employee.work_email
                    if not email:
                        continue
                    render_template = appraisal.mail_template_id.with_context(email=email, survey=survey, employee=employee).generate_email([appraisal.id])
                    values = {
                        'survey_id': survey.id,
                        'public': 'email_private',
                        'partner_ids': employee.related_partner_id and [(4, employee.related_partner_id.id)] or False,
                        'multi_email': email,
                        'subject': '%s appraisal: %s' % (appraisal.employee_id.name, survey.title),
                        'body': render_template[appraisal.id]['body'],
                        'date_deadline': appraisal.date_close,
                        'model': appraisal._name,
                        'res_id': appraisal.id,
                    }
                    compose_message_wizard = ComposeMessage.with_context(active_id=appraisal.id, active_model=appraisal._name, notif_layout="mail.mail_notification_light").create(values)
                    compose_message_wizard.send_mail()  # Sends a mail and creates a survey.user_input
                    if employee.user_id:
                        user_input = survey.user_input_ids.filtered(lambda user_input: user_input.partner_id == employee.user_id.partner_id and user_input.state != 'done')
                        if user_input:
                            form_url = survey.public_url + '/' + user_input[0].token
                        else:
                            form_url = survey.public_url
                        appraisal.activity_schedule(
                            'hr_appraisal.mail_act_appraisal_form', appraisal.date_close,
                            note=_('Fill form <a href="%s">%s</a> for <a href="#" data-oe-model="%s" data-oe-id="%s">%s\'s</a> appraisal') % (
                                form_url, survey.display_name,
                                appraisal.employee_id._name, appraisal.employee_id.id, appraisal.employee_id.display_name),
                            user_id=employee.user_id.id)
            appraisal.message_post(body=_("Appraisal form(s) have been sent"))
        return True

    @api.multi
    def cancel_appraisal(self):
        """ Cancels the appraisal process, removing related calendar events,
        removes sent surveys and generated activities. """
        for appraisal in self:
            if appraisal.meeting_id:
                appraisal.meeting_id.unlink()

            appraisal.survey_sent_ids.unlink()
            appraisal.date_final_interview = False
        self.activity_unlink(['mail.mail_activity_data_meeting', 'hr_appraisal.mail_act_appraisal_form'])

    @api.model
    def create(self, vals):
        result = super(HrAppraisal, self.with_context(mail_create_nolog=True)).create(vals)
        result.subscribe_employees()
        date_final_interview = vals.get('date_final_interview')
        if date_final_interview:
            # creating employee meeting and interview date
            result.schedule_final_meeting(date_final_interview)
        return result

    @api.multi
    def write(self, vals):
        if vals.get('state'):
            if vals['state'] == 'cancel':
                self.cancel_appraisal()
            if vals['state'] == 'pending':
                self.send_appraisal()
        result = super(HrAppraisal, self).write(vals)
        date_final_interview = vals.get('date_final_interview')
        if vals.get('date_close'):
            self.activity_reschedule(['hr_appraisal.mail_act_appraisal_form'], date_deadline=vals['date_close'])
        if date_final_interview:
            # creating employee meeting and interview date
            self.schedule_final_meeting(date_final_interview)
        return result

    @api.multi
    def unlink(self):
        for appraisal in self:
            if appraisal.state != 'new' and appraisal.state != 'cancel':
                appraisal_state = dict(self.APPRAISAL_STATES)
                raise UserError(_("You cannot delete appraisal which is in %s state") % (appraisal_state[appraisal.state]))
        return super(HrAppraisal, self).unlink()

    @api.model
    def read_group(self, domain, fields, groupby, offset=0, limit=None, orderby=False, lazy=True):
        """ Override read_group to always display all states and order them appropriatly. """
        if groupby and groupby[0] == "state":
            states = [('new', _('To Start')), ('pending', _('Appraisal Sent')), ('done', _('Done')), ('cancel', _('Cancelled'))]
            read_group_all_states = [{
                '__context': {'group_by': groupby[1:]},
                '__domain': domain + [('state', '=', state_value)],
                'state': state_value,
                'state_count': 0,
            } for state_value, state_name in states]
            # Get standard results
            read_group_res = super(HrAppraisal, self).read_group(domain, fields, groupby, offset=offset, limit=limit, orderby=orderby)
            # Update standard results with default results
            result = []
            for state_value, state_name in states:
                res = [x for x in read_group_res if x['state'] == state_value]
                if not res:
                    res = [x for x in read_group_all_states if x['state'] == state_value]
                res[0]['state'] = state_value
                if res[0]['state'][0] == 'done' or res[0]['state'][0] == 'cancel':
                    res[0]['__fold'] = True
                result.append(res[0])
            return result
        else:
            return super(HrAppraisal, self).read_group(domain, fields, groupby, offset=offset, limit=limit, orderby=orderby)

    @api.multi
    def action_get_users_input(self):
        """ Link to open sent appraisal"""
        self.ensure_one()
        action = self.env.ref('survey.action_survey_user_input').read()[0]
        if self.env.context.get('answers'):
            users_input = self.survey_completed_ids
        else:
            users_input = self.survey_sent_ids
        action['domain'] = str([('id', 'in', users_input.ids)])
        action['context'] = {}  # Remove default group_by for surveys.
        return action

    @api.multi
    def action_calendar_event(self):
        """ Link to open calendar view for creating employee interview/meeting"""
        self.ensure_one()
        partner_ids = [manager.related_partner_id.id for manager in self.manager_ids if manager.related_partner_id]
        if self.employee_id.related_partner_id:
            partner_ids.append(self.employee_id.related_partner_id.id)
        action = self.env.ref('calendar.action_calendar_event').read()[0]
        partner_ids.append(self.env.user.partner_id.id)
        action['context'] = {
            'default_partner_ids': partner_ids,
            'search_default_mymeetings': 1
        }
        return action

    @api.multi
    def button_send_appraisal(self):
        self.write({'state': 'pending'})

    @api.multi
    def button_done_appraisal(self):
        self.write({'state': 'done'})
        self.activity_feedback(['mail.mail_activity_data_meeting', 'hr_appraisal.mail_act_appraisal_form'])

    @api.multi
    def button_cancel_appraisal(self):
        self.write({'state': 'cancel'})
