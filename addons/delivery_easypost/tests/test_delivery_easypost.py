# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import TransactionCase, tagged

@tagged('-standard', 'external')
class TestDeliveryEasypost(TransactionCase):
    def setUp(self):
        super(TestDeliveryEasypost, self).setUp()
        self.your_company = self.env.ref('base.main_partner')
        self.your_company.write({'name': 'Odoo SA',
                                 'street': "44 Wall Street",
                                 'street2': "Suite 603",
                                 'city': "New York",
                                 'zip': 10005,
                                 'state_id': self.env.ref('base.state_us_27').id,
                                 'country_id': self.env.ref('base.us').id,
                                 'phone': "+1 (929) 352-6366"})

        self.jackson = self.env.ref('base.res_partner_10')
        self.agrolait = self.env.ref('base.res_partner_2')
        self.server = self.env.ref('product.consu_delivery_01')
        self.miniServer = self.env.ref('product.consu_delivery_02')

        self.server['weight'] = 3.0
        self.server['volume'] = 0.4
        self.miniServer['weight'] = 2.0
        self.miniServer['volume'] = 0.35

        self.easypost_fedex_carrier_product = self.env['product.product'].create({
            'name': 'Fedex Easypost',
            'type': 'service',
        })

        self.easypost_fedex_carrier = self.env['delivery.carrier'].create({
            'name': 'EASYPOST FedEx',
            'delivery_type': 'easypost',
            'easypost_test_api_key': 'oEYcRdeaXMQYjypBCx0nlg',
            'easypost_production_api_key': 'zhiDnLnzKCVkelNzVAfWEQ',
            'product_id': self.easypost_fedex_carrier_product.id,
        })
        product_type_wizard = self.easypost_fedex_carrier.action_get_carrier_type()
        self.easypost_fedex_carrier.easypost_delivery_type = 'FedEx'
        self.easypost_fedex_carrier.easypost_delivery_type_id = product_type_wizard['context']['carrier_types']['FedEx']

        self.fedex_default_packaging = self.env['product.packaging'].create({
            'name': 'My FedEx Box',
            'package_carrier_type': 'easypost',
            'max_weight': 10,
            'height': 10,
            'length': 10,
            'width': 10,
        })
        self.easypost_fedex_carrier.easypost_default_packaging_id = self.fedex_default_packaging

    def test_easypost_one_package_shipping(self):
        """ Try to rate and ship an order from
        New York to Miami. It will not use a specific
        package and everything will be consider to be
        inside the same package.
        """
        SaleOrder = self.env['sale.order']
        sol_1_vals = {'product_id': self.server.id}
        sol_2_vals = {'product_id': self.miniServer.id}
        so_vals_fedex = {'partner_id': self.jackson.id,
                   'carrier_id': self.easypost_fedex_carrier.id,
                   'order_line': [(0, None, sol_1_vals), (0, None, sol_2_vals)]}

        sale_order_fedex = SaleOrder.create(so_vals_fedex)
        sale_order_fedex.get_delivery_price()

        self.assertGreater(sale_order_fedex.delivery_price, 0.00, "Could't get rate for this order from easypost fedex")
        sale_order_fedex.action_confirm()

        self.assertEquals(len(sale_order_fedex.picking_ids), 1, "The Sales Order did not generate a picking for ep-fedex.")
        picking_fedex = sale_order_fedex.picking_ids[0]
        self.assertEquals(picking_fedex.carrier_id.id, sale_order_fedex.carrier_id.id,
                          "Carrier is not the same on Picking and on SO(easypost-fedex).")

        picking_fedex.action_assign()
        picking_fedex.move_line_ids.write({'qty_done': 1})
        self.assertGreater(picking_fedex.weight, 0.0, "Picking weight should be positive.(ep-fedex)")
        picking_fedex.action_done()
        self.assertGreater(picking_fedex.carrier_price, 0.0, "Easypost carrying price is probably incorrect(fedex)")
        self.assertIsNot(picking_fedex.carrier_tracking_ref, False,
                         "Easypost did not return any tracking number (fedex)")

    def test_easypost_multiple_packages_shipping(self):
        """ Same than test with one package. This
        time it will use the put in pack functionality.
        It will send twice the default packaging with
        2 servers and 3 mini servers.
        """
        SaleOrder = self.env['sale.order']
        sol_1_vals = {'product_id': self.server.id}
        sol_2_vals = {'product_id': self.miniServer.id}
        so_vals_fedex = {'partner_id': self.jackson.id,
                   'carrier_id': self.easypost_fedex_carrier.id,
                   'order_line': [(0, None, sol_1_vals), (0, None, sol_2_vals)]}

        sale_order_fedex = SaleOrder.create(so_vals_fedex)
        sale_order_fedex.get_delivery_price()

        self.assertGreater(sale_order_fedex.delivery_price, 0.00, "Could't get rate for this order from easypost fedex")
        sale_order_fedex.action_confirm()

        self.assertEquals(len(sale_order_fedex.picking_ids), 1, "The Sales Order did not generate a picking for ep-fedex.")
        picking_fedex = sale_order_fedex.picking_ids[0]
        self.assertEquals(picking_fedex.carrier_id.id, sale_order_fedex.carrier_id.id,
                          "Carrier is not the same on Picking and on SO(easypost-fedex).")

        picking_fedex.action_assign()
        picking_fedex.move_lines[0].write({'quantity_done': 2})
        picking_fedex._put_in_pack()
        picking_fedex.move_lines[0].move_line_ids.result_package_id.packaging_id = self.fedex_default_packaging.id
        picking_fedex.move_lines[1].write({'quantity_done': 3})
        picking_fedex._put_in_pack()
        picking_fedex.move_lines[1].move_line_ids.result_package_id.packaging_id = self.fedex_default_packaging.id
        self.assertGreater(picking_fedex.weight, 0.0, "Picking weight should be positive.(ep-fedex)")
        picking_fedex.action_done()
        self.assertGreater(picking_fedex.carrier_price, 0.0, "Easypost carrying price is probably incorrect(fedex)")
        self.assertIsNot(picking_fedex.carrier_tracking_ref, False,
                         "Easypost did not return any tracking number (fedex)")

    def test_easypost_one_package_international_shipping(self):
        """ Same than test_easypost_one_package_shipping with
        an international shipping. (it matters due to customs info).
        """
        SaleOrder = self.env['sale.order']
        sol_1_vals = {'product_id': self.server.id}
        sol_2_vals = {'product_id': self.miniServer.id}
        so_vals_fedex = {'partner_id': self.agrolait.id,
                   'carrier_id': self.easypost_fedex_carrier.id,
                   'order_line': [(0, None, sol_1_vals), (0, None, sol_2_vals)]}

        # Modify price due to US customs info. If you a value greater than
        # 2500$, it requires an specific AES code.
        self.server['list_price'] = 10.0
        self.miniServer['list_price'] = 10.0

        sale_order_fedex = SaleOrder.create(so_vals_fedex)
        sale_order_fedex.get_delivery_price()

        self.assertGreater(sale_order_fedex.delivery_price, 0.00, "Could't get rate for this order from easypost fedex")
        sale_order_fedex.action_confirm()

        self.assertEquals(len(sale_order_fedex.picking_ids), 1, "The Sales Order did not generate a picking for ep-fedex.")
        picking_fedex = sale_order_fedex.picking_ids[0]
        self.assertEquals(picking_fedex.carrier_id.id, sale_order_fedex.carrier_id.id,
                          "Carrier is not the same on Picking and on SO(easypost-fedex).")

        picking_fedex.action_assign()
        picking_fedex.move_line_ids.write({'qty_done': 1})
        self.assertGreater(picking_fedex.weight, 0.0, "Picking weight should be positive.(ep-fedex)")
        picking_fedex.action_done()
        self.assertGreater(picking_fedex.carrier_price, 0.0, "Easypost carrying price is probably incorrect(fedex)")
        self.assertIsNot(picking_fedex.carrier_tracking_ref, False,
                         "Easypost did not return any tracking number (fedex)")
