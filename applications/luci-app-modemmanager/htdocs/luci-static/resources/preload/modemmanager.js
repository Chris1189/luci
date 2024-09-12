'use strict';
'require ui';
'require rpc';
'require poll';
'require baseclass';

var callModems = rpc.declare({
	object: 'network.modemmanager.modem',
	method: 'dump',
	expect: { 'modem': [] }
});

var infos = {};

return baseclass.extend({
	__init__: function () {
		this.updateModemManagerIndicator();
		poll.add(L.bind(this.updateModemManagerIndicator, this), 5);
	},

	handleDetails: function (ev) {
		var modem_name = ev.currentTarget.getAttribute('data-indicator').replace(/^signal-/, '');
		var info = infos[modem_name];

		if (!info)
			return;

		var table = E('table', { 'class': 'table' });

		if (info.device)
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [
					_('Modem')
				]),
				E('td', { 'class': 'td left' }, [ info.device ])
			]));

		if (info.signal)
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [
					_('Signal strength')
				]),
				E('td', { 'class': 'td left' }, [ '%d%'.format(info.signal) ])
			]));

		if (info.operator)
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [
					_('Operator')
				]),
				E('td', { 'class': 'td left' }, [ info.operator ])
			]));

		if (info.technology_generation.id > 0)
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [
					_('Technology Generation')
				]),
				E('td', { 'class': 'td left' }, [ info.technology_generation.name.toUpperCase() ])
			]));

		if (info.technologies && info.technologies.length)
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [
					_('Technology')
				]),
				E('td', { 'class': 'td left' }, [
					info.technologies.map(technology => technology.toUpperCase()).join(', ')
				])
			]));

		if (info.sim.iccid)
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [
					_('ICCID')
				]),
				E('td', { 'class': 'td left' }, [ info.sim.iccid ])
			]));

		if (info.sim.imsi)
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [
					_('IMSI')
				]),
				E('td', { 'class': 'td left' }, [ info.sim.imsi ])
			]));

		if (info.imei)
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [
					_('IMEI')
				]),
				E('td', { 'class': 'td left' }, [ info.imei ])
			]));

		ui.showModal(_('Signal details'), [
			table,
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'cbi-button',
					'click': ui.hideModal
				}, [ _('Close') ])
			])
		]);
	},

	updateModemManagerIndicator: function () {
		callModems().then(L.bind(function (modems) {
			Promise.all(modems.map(L.bind(function (modem) {
				var sim_promise;

				if (modem.signal > 66 ) {
					modem.bar = '<font>▃▅▇</font>';
				} else if (modem.signal > 33 && modem.signal <= 66) {
					modem.bar = '▃▅<font style="opacity: 0.3;">▇</font>';
				} else if (modem.signal > 0 && modem.signal <= 33) {
					modem.bar = '▃<font style="opacity: 0.3;">▅▇</font>';
				} else {
					modem.bar = '<font style="opacity: 0.3;">▃▅▇</font>';
				}
				modem.indicator = 'signal-%s'.format(modem.name);

				if (!modem.primary_sim_name) {
					/* no primary SIM */
					sim_promise = Promise.resolve(() => {});
				} else {
					var callSim = rpc.declare({
						object: 'network.modemmanager.sim.%s'.format(modem.primary_sim_name),
						method: 'dump',
						expect: { }
					});
					sim_promise = callSim();
				}

				return sim_promise.then(L.bind(function (sim) {
					modem.sim = sim;
					ui.showIndicator(modem.indicator,
						null,
						L.bind(this.handleDetails, this)
					);
					modem.element = document.querySelector(`[data-indicator="${modem.indicator}"]`);
					modem.element.innerHTML = modem.bar;

					return modem;
				}, this));
			}, this))).then(function (modems) {
				Object.entries(infos).forEach(function ([modem_name, modem]) {
					var matching_modem = modems.find(modem => modem.name == modem_name);
					if (!matching_modem) {
						/* modem is now removed */
						ui.hideIndicator(modem.indicator);
					}
				});

				modems.forEach(function (modem) {
					infos[modem.name] = modem;
				});
			});
		}, this));
	}
});
