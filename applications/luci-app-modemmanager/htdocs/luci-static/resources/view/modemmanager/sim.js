'use strict';
'require view';
'require fs';
'require ui';
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

var pin_remaining;
var puk_remaining;

return view.extend({

	load: function () {
		return Promise.all([callSims(), callModems()]);
	},

	handlePINSubmit: function (state, sim, ev) {
		var pin_retries = document.querySelector('[name="pin_retries"]');
		if (state == 'enable') {
			var pin = document.querySelector('[name="enable_pin"]').value;

			L.resolveDefault(
				fs.exec_direct('/usr/libexec/modemmanager/sim',
					[ 'enable' , sim, pin ]), null)
				.then(function (res) {
					if (res.includes('successfully')) {
						ui.addNotification(null, E('p', _('PIN successfully verified')), 'success');
						setTimeout(location.reload(), 5000);
					} else {
						ui.addNotification(null, E('p', _('Unable to verify PIN')), 'danger');
						pin_remaining = pin_remaining - 1;
						pin_retries.innerText = pin_remaining > 0 ? pin_remaining : 0;

						if (pin_remaining == 0) {
							setTimeout(location.reload(), 5000);
						}
					}
				});
		}

		else if (state == 'disable') {
			var pin = document.querySelector('[name="pin"]').value;
			return L.resolveDefault(
				fs.exec_direct('/usr/libexec/modemmanager/sim',
					[ 'disable' , sim, pin ]), null)
				.then(function (res) {
					if (res.includes('successfully')) {
						ui.addNotification(null, E('p', _('SIM verification successfully disabled')), 'success');
						setTimeout(location.reload(), 5000);
					} else {
						ui.addNotification(null, E('p', _('Unable to disable SIM protection')), 'danger');
						pin_remaining = pin_remaining - 1;
						pin_retries.innerText = pin_remaining > 0 ? pin_remaining : 0;

						if (pin_remaining == 0) {
							setTimeout(location.reload(), 5000);
						}
					}
				});
		}

		else if (state == 'change') {
			var newpin = document.querySelector('[name="newpin"]').value;
			var oldpin = document.querySelector('[name="oldpin"]').value;

			return L.resolveDefault(
				fs.exec_direct('/usr/libexec/modemmanager/sim',
					[ 'change', sim, oldpin, newpin ]), null)
				.then(function (res) {
					if (res.includes('successfully')) {
						ui.addNotification(null, E('p', _('PIN successfully changed')), 'success');
						setTimeout(location.reload(), 5000);
					} else {
						ui.addNotification(null, E('p', _('Unable to change PIN')), 'danger');
						pin_remaining = pin_remaining - 1;
						pin_retries.innerText = pin_remaining > 0 ? pin_remaining : 0;

						if (pin_remaining == 0) {
							setTimeout(location.reload(), 5000);
						}
					}
				});
		}

		else if (state == 'verify') {
			var pin = document.querySelector('[name="pin"]').value;
			return L.resolveDefault(
				fs.exec_direct('/usr/libexec/modemmanager/sim',
					[ 'verify' , sim, pin ]), null)
				.then(function (res) {
					if (res.includes('successfully')) {
						ui.addNotification(null, E('p', _('SIM verification successfull')), 'success');
						setTimeout(location.reload(), 5000);
					} else {
						ui.addNotification(null, E('p', _('Unable to verify PIN')), 'danger');
						pin_remaining = pin_remaining - 1;
						pin_retries.innerText = pin_remaining > 0 ? pin_remaining : 0;

						if (pin_remaining == 0) {
							setTimeout(location.reload(), 5000);
						}
					}
				});
		}
	},

	handlePUKSubmit: function (sim, ev) {
		var puk = document.querySelector('[name="puk"]').value;
		var pin = document.querySelector('[name="pin_with_puk"]').value;
		var puk_retries = document.querySelector('[name="puk_retries"]');

		return L.resolveDefault(
			fs.exec_direct('/usr/libexec/modemmanager/sim',
				[ 'unblock', sim, pin, puk ]), null)
			.then(function (res) {
				if (res.includes('successfully')) {
					ui.addNotification(null, E('p', _('SIM successfully unblocked')), 'success');
					setTimeout(location.reload(), 5000);
				} else {
					ui.addNotification(null, E('p', _('Unable to unblock SIM')), 'danger');
					puk_remaining = puk_remaining - 1;
					puk_retries.innerText = puk_remaining > 0 ? puk_remaining : 0;
				}
			});
	},

	handleVerify: function (div, sim, sim_state) {
		if (sim_state == 'disabled') {
			return div.appendChild(
				E('div', {'class': 'cbi-section cbi-tblsection'}, [
					E('div', {'class': 'cbi-section-create cbi-tblsection-create'}, [
						E('label', {}, [ _('Current PIN') ]),
						E('input', { 'type': 'text', 'name': 'enable_pin', 'title': 'enable_pin' }),
						E('button', {
							'class': 'btn cbi-button cbi-button-apply',
							'click': ui.createHandlerFn(this,
								'handlePINSubmit',
								'enable',
								sim)
						}, _('Enable'))
					]),
				])
			);
		}

		if (sim_state == 'verified') {
			div.appendChild(
				E('div', {'class': 'cbi-section cbi-tblsection'}, [
					E('div', {'class': 'cbi-section-create cbi-tblsection-create'}, [
						E('label', {}, [ _('Current PIN') ]),
						E('input', { 'type': 'text', 'name': 'pin', 'title': 'pin' }),
						E('button', {
							'class': 'btn cbi-button cbi-button-apply',
							'click': ui.createHandlerFn(this,
								'handlePINSubmit',
								'disable',
								sim)
						}, _('Disable'))
					]),
				])
			);
			return div.appendChild(
				E('div', {'class': 'cbi-section cbi-tblsection'}, [
					E('div', {'class': 'cbi-section-create cbi-tblsection-create'}, [
						E('label', {}, [ _('Current PIN') ]),
						E('input', { 'type': 'text', 'name': 'oldpin', 'title': 'oldpin' }),
						E('label', {}, ['New PIN']),
						E('input', { 'type': 'text', 'name': 'newpin', 'title': 'newpin' }),
						E('button', {
							'class': 'btn cbi-button cbi-button-apply',
							'click': ui.createHandlerFn(this,
								'handlePINSubmit',
								'change',
								sim)
						}, _('Change'))
					]),
				])
			);
		}

		if (sim_state == 'blocked') {
			return div.appendChild(
				E('div', {'class': 'cbi-section cbi-tblsection'}, [
					E('div', {'class': 'cbi-section-create cbi-tblsection-create'}, [
						E('label', {}, [ _('PUK') ]),
						E('input', { 'type': 'text', 'name': 'puk', 'title': 'puk'}),
						E('label', {}, [ _('PIN') ]),
						E('input', { 'type': 'text', 'name': 'pin_with_puk','title': 'pin_with_puk' }),
						E('button', {
							'class': 'btn cbi-button cbi-button-apply',
							'click': ui.createHandlerFn(this,
								'handlePUKSubmit',
								sim)
						}, _('Unblock'))
					]),
				]));
		}

		if (sim_state == 'unverified') {
			return div.appendChild(
				E('div', {'class': 'cbi-section cbi-tblsection'}, [
					E('div', {'class': 'cbi-section-create cbi-tblsection-create'}, [
						E('label', {}, [ _('Current PIN') ]),
						E('input', { 'type': 'text', 'name': 'pin', 'title': 'pin' }),
						E('button', {
							'class': 'btn cbi-button cbi-button-apply',
							'click': ui.createHandlerFn(this,
								'handlePINSubmit',
								'verify',
								sim)
						}, _('Unlock'))
					]),
				])
			);
		}
	},

	renderFailed: function (node, modem, device) {
		if (modem.state_failed_reason.name == 'sim-missing') {
			return node.firstElementChild.appendChild(
				E('div', { 'data-tab': device, 'data-tab-title': device }, [
					E('div', {'class': 'cbi-map-descr'}),
					E('div', { 'class': 'cbi-section', 'id': device + '-mmcli' }, [
						_('SIM missing')
					]),
				])
			);
		}
	},

	renderTable: function (node, iccid, device, sim, lockstate_current) {
		var target = node.firstElementChild;
		target.appendChild(E('div', { 'class': 'cbi-section', 'data-tab': device, 'data-tab-title': device, 'id': 'container' }, [
				E('div', {'class': 'cbi-map-descr'}),
				E('table', { 'class': 'table', 'id': device + '-mmcli' }, [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left', width: '33%'}, [ _('SIM') ]),
						E('td', { 'class': 'td left', 'id': 'sim'}, [ sim ]),
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left', width: '33%' }, [ _('ICCID') ]),
						E('td', { 'class': 'td left'},[ iccid ]),
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td left', width: '33%' }, [ _('PIN query status') ]),
						E('td', { 'class': 'td left', 'name': 'state' }, [ lockstate_current ]),
					]),
					E('tr', { 'class': 'tr' },[
						E('td', { 'class': 'td left', width: '33%' }, [ _('Remaining verify tries') ]),
						E('td', { 'class': 'td left', 'name': 'pin_retries' }, [ pin_remaining ]),
					]),
				]),
		]));

		if (target.querySelector('[name="state"]').innerText == 'blocked') {
			target.querySelector('table').appendChild(
				E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left', width: '33%'}, [ _('Remaining unblock tries') ]),
					E('td', { 'class': 'td left', 'name': 'puk_retries' }, [ puk_remaining ]),
				]));
		}

		this.handleVerify(target.lastElementChild, sim, lockstate_current);

		return node;
	},

	render: function ([sims, modems]) {
		var lockstate_current;
		var node = E('div', {}, E('div'));

		if (!modems) {
			return E([], [
				E('h2', {}, [ _('Mobile Service - Overview') ]),
				E('p', {}, [ _('No Modem found') ])
			]);
		}

		modems.forEach(L.bind(function (modem) {
			var modemSim = sims.find(sim => sim.name == modem.primary_sim_name);
			var sim_lock_enabled = modem.enabled_locks.find(lock => lock == 'sim') != undefined;
			var state = modem.state.name;

			if (state == 'failed') {
				this.renderFailed(node, modem, modem.name);
				return;
			}

			pin_remaining = modem.unlock_retries['sim-pin'];
			puk_remaining = modem.unlock_retries['sim-puk'];

			if (!sim_lock_enabled) {
				lockstate_current = 'disabled';
			}

			if (sim_lock_enabled && state != 'locked') {
				lockstate_current = 'verified';
			}

			if (modem.unlock_required == 'sim-puk' && state == 'locked') {
				lockstate_current = 'blocked';
			}

			this.renderTable(node, modemSim.iccid, modem.name, modemSim.name, lockstate_current);
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

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
