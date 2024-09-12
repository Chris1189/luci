'use strict';
'require ui';
'require view';
'require poll';
'require dom';
'require rpc';

var callModems = rpc.declare({
	object: 'network.modemmanager.modem',
	method: 'dump',
	expect: { 'modem': [] }
});
var callSims = rpc.declare({
	object: 'network.modemmanager.sim',
	method: 'dump',
	expect: { 'sim': [] }
});

return view.extend({
	load: function () {
		return Promise.all([callSims(), callModems().then(function (modems) {
			return Promise.all(modems.map(function (modem) {
				return rpc.declare({
					object: 'network.modemmanager.modem.%s'.format(modem.name),
					method: 'get-location',
					expect: { '3gpp': {} }
				})().then(function (location) {
					modem.location = location;
					return modem;
				});
			}));
		})]);
	},

	pollData: function (container) {
		poll.add(L.bind(function () {
			return this.load().then(L.bind(function (modems) {
				dom.content(container, this.renderContent(modems));
			}, this));
		}, this));
	},

	renderSections: function (name, sections) {
		if (sections.length == 0) {
			sections.push(E('div', { 'class': 'cbi-section' }, [
				E('span', {}, _('Section %s is empty.').format(name))
			]));
		}

		return E('div', { 'class': 'cbi-section' }, [
			E('h1', {}, name),
			...sections
		]);
	},

	renderSection: function (name, table) {
		var rowNodes = table.filter(
			row => row[1] != null && row[1] != ''
		).map(function (row) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'width': '33%' }, E('strong', {}, [row[0]])),
				E('td', { 'class': 'td' }, [row[1]])
			]);
		});

		var tableNode;
		if (rowNodes.length == 0) {
			tableNode = E('div', { 'class': 'cbi-section' }, [
				E('span', {}, _('Section %s is empty.').format(name))
			])
		} else {
			tableNode = E('table', { 'class': 'table', }, rowNodes);
		}

		return E('div', { 'class': 'cbi-section' }, [
			E('h2', {}, [name]),
			tableNode
		]);
	},

	renderContent: function ([sims, modems]) {
		var node = E('div', {}, E('div'));

		modems.forEach(L.bind(function (modem) {
			var modemSection = this.renderSection(_('Modem Info'), [
				[_('Manufacturer'), modem.manufacturer],
				[_('Model'), modem.model],
				[_('Revision'), modem.revision],
				[E('abbr', { 'title': _('International Mobile Station Equipment Identity') }, [
					_('IMEI')
				]), modem.imei],
				[_('Device Identifier'), modem.device_identifier],
				[_('Power State'), modem.power_state.name],
				[_('State'), modem.state.name],
				[_('Failed Reason'), modem.state_failed_reason.name]
			]);

			var ownNumbersStr = modem.own_numbers.join(', ');
			var accessTechnologiesStr = modem.technologies.map(t => t.toUpperCase()).join(', ');
			var technologyGenerationStr = modem.technology_generation.name.toUpperCase();
			var networkSection = this.renderSection(_('Network Registration'), [
				[_('Mobile phone number'), ownNumbersStr],
				[_('Technology Generation'), modem.technology_generation.id != 0 ? technologyGenerationStr : ""],
				[_('Access Technologies'), accessTechnologiesStr],
				[_('Operator') , modem.operator_name],
				[_('Operator Code'), modem.operator_code],
				[_('Registration State'), modem.registration_state.name],
				[_('Packet Service State'), modem.packet_service_state.name],
				[_('Signal Quality'), E('div', { 'class': 'cbi-progressbar', 'title': '%d %'.format(modem.signal) }, [
					E('div', { 'style': 'width: %d%%'.format(modem.signal) })
				])]
			]);

			var locationSection = this.renderSection(_('Cell Location'), [
				[E('abbr', { 'title': _('Cell ID') }, [
					'CID'
				]), modem.location.cid],
				[E('abbr', { 'title': _('Location Area Code') }, [
					'LAC'
				]), modem.location.lac],
				[E('abbr', { 'title': _('Mobile Country Code') }, [
					'MCC'
				]), modem.location.mcc],
				[E('abbr', { 'title': _('Mobile Network Code') }, [
					'MNC'
				]), modem.location.mnc],
				[E('abbr', { 'title': _('Tracking Area Code') }, [
					'TAC'
				]), modem.location.tac]
			]);

			var modemSims = sims.filter(sim => sim.modem_name == modem.name);
			var simTables = modemSims.map(function (sim) {
				return [
					[_('Active'), sim.active],
					[_('Operator Name'), sim.operator],
					[E('abbr', { 'title': _('Integrated Circuit Card Identifier') }, [
						'ICCID'
					]), sim.iccid],
					[E('abbr', { 'title': _('International Mobile Subscriber Identity') }, [
						'IMSI'
					]), sim.imsi]
				];
			});
			var simSubSections = simTables.map(L.bind(function (table, index) {
				return this.renderSection(_('SIM %d').format(index + 1), table)
			}, this));
			var simSection = this.renderSections(_('SIMs'), simSubSections);

			var sections = [
				E('div', { 'class': 'cbi-map-descr'}, []),
				modemSection,
				networkSection,
				locationSection,
				simSection
			].filter(section => section != null);
			node.firstElementChild.appendChild(E('div', { 'data-tab': modem.name, 'data-tab-title': modem.name }, sections));
		}, this));

		if (modems.length > 0) {
			ui.tabs.initTabGroup(node.firstElementChild.childNodes);
			return node;
		} else {
			return E('p', { 'class': 'center', 'style': 'margin-top:5em' }, [
				E('em', [ _('No mobile service status available.') ])
			]);
		}
	},

	render: function (modems) {
		var content = E([], [
			E('h2', {}, [_('Cellular Network')]),
			E('div', {'class': 'cbi-map-descr'}, _('This overview shows the current status of the mobile service.')),
			E('div')
		]);
		var container = content.lastElementChild;

		dom.content(container, this.renderContent(modems));
		this.pollData(container);

		return content;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
