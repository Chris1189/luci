// SPDX: Apache-2.0
// Karl Palsson <karlp@etactica.com> 2021
"use strict";
"require form";
"require uci";
"require fs";
"require rpc";
"require ui";
"require view";

return L.view.extend({
	load: function() {
		return Promise.all([
			uci.load(["snmpd", "luci_snmpd"]).then(function() {
				var mibFile = uci.get("luci_snmpd", "snmpd", "download_mib");
				if (mibFile)
					return L.resolveDefault(fs.stat(mibFile), null);
				else
					return Promise.resolve(null);
			}),
		]);
	},

	__init__: function() {
		this.super('__init__', arguments);

		this.ro_community = null;
		this.ro_community_src = null;
		this.rw_community = null;
		this.rw_community_src = null;
		this.oid = null;
		this.ip_protocol = null;
		this.snmp_version = null;
	},

	trapsConfigure: function(t_enable, t_version, t_host, t_port, t_community) {
		var traps = 0;
		uci.sections('snmpd', 'trapsink', function(s) {
			traps++;
			if ((traps > 1) || (t_enable == '0') || (t_version !== 'v1')) {
				uci.remove('snmpd', s['.name']);
			}
		});

		traps = 0;
		uci.sections('snmpd', 'trap2sink', function(s) {
			traps++;
			if ((traps > 1) || (t_enable == '0') || (t_version !== 'v2c')) {
				uci.remove('snmpd', s['.name']);
			}
		});

		if (t_enable == '1') {
			var sink;
			if (t_version == 'v1')
				sink = 'trapsink';
			else
				sink = 'trap2sink';

			var s = uci.get_first('snmpd', sink);
			var sid = s ? s['.name'] : uci.add('snmpd', sink);

			uci.set('snmpd', sid, 'community', t_community);
			uci.set('snmpd', sid, 'host', t_host);
			uci.set('snmpd', sid, 'port', t_port);
		}
	},

	populateSystemSettings: function(tab, s, data) {
		var g, go, o;

		var mibStat = data[0];

		o = s.taboption("general", form.SectionValue, "__general__",
			form.TypedSection, "system", null,
			_("Here you can configure system settings"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = false;

		function snmpd_sys_cfgvalue(section) {
			var s = uci.get_first('snmpd', 'system');
			return s && uci.get('snmpd', s['.name'], this.option || '');
		};

		function snmpd_sys_remove(section) {
			var s = uci.get_first('snmpd', 'system');
			if (s)
				uci.unset('snmpd', s['.name'], this.option);
		};

		function snmpd_sys_write(section, value) {
			var s = uci.get_first('snmpd', 'system');
			var sid = s ? s['.name'] : uci.add('snmpd', 'system');
			uci.set('snmpd', sid, this.option, value);
		};

		if (mibStat) {
			go = g.option(form.Button, '__download', _('MIB download') );
			go.inputtitle = _('Download (%1024.2mB)', 'Download data (action)').format(mibStat.size);
			go.inputstyle = 'action';
			go.onclick = ui.createHandlerFn(this, function(ev) {
				return fs.read(mibStat.path).then(function(data) {
					var url = URL.createObjectURL(new Blob([data], {
						type: 'text/plain'}));

					var link = document.createElement('a');
					link.href = url;
					link.download = mibStat.path.replace(/^.*[\\\/]/, '');
					link.click();
					return Promise.resolve();
				});
			});
		}

		go = g.option(form.Value, "sysName", _("Name"),
			_("System Name"));
		go.cfgvalue = snmpd_sys_cfgvalue;
		go.write = snmpd_sys_write;
		go.remove = snmpd_sys_remove;

		go = g.option(form.Value, "sysContact", _("Contact"),
			_('System contact'));
		go.cfgvalue = snmpd_sys_cfgvalue;
		go.write = snmpd_sys_write;
		go.remove = snmpd_sys_remove;
		
		go = g.option(form.Value, "sysLocation", _("Location"),
			_('System location'));
		go.cfgvalue = snmpd_sys_cfgvalue;
		go.write = snmpd_sys_write;
		go.remove = snmpd_sys_remove;
	},
	
	populateGlobalSettings: function(tab, s, data) {
		var go, g, o;

		o = s.taboption("general", form.SectionValue, "__general__",
			form.TypedSection, "snmpd", null,
			_("Here you can configure agent settings"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = false;

		go = g.option(form.Flag, "enabled", _("Enable SNMP"),
			_("Enable to use SNMP"));
		go.default = "0";
		go.rmempty = false;

		this.ip_protocol = g.option(form.ListValue, 'ip_protocol', _('IP version'));
		this.ip_protocol.value('ipv4', _('Only IPv4'));
		this.ip_protocol.value('ipv6', _('Only IPv6'));
		this.ip_protocol.value('ipv4/ipv6', _('IPv4 and IPv6'));
		this.ip_protocol.optional = false;
		this.ip_protocol.forcewrite = true;
		this.ip_protocol.default = "IPv4";
		this.ip_protocol.rmempty = false;

		this.ip_protocol.cfgvalue = function(section_id) {
			var ip_protocol = uci.get('snmpd', section_id, 'ip_protocol');

			if (!ip_protocol) {
				var s = uci.get_first('snmpd', 'agent');
				if (!s)
					return null;

				var addr = uci.get('snmpd', s['.name'], 'agentaddress');
				var p = [];

				if (!addr)
					return null;

				addr = addr.toUpperCase();

				if (addr.match(/UDP:\d+/g))
					p.push('ipv4');

				if (addr.match(/UDP6:\d+/g))
					p.push('ipv6');

				ip_protocol = p.join('/');
			}

			return ip_protocol;
		};

		go = g.option(form.Value, "snmp_port", _("Port"));
		go.rmempty = false;
		go.default = '161';
		go.datatype = 'port';
		go.forcewrite = true;
		go.cfgvalue = function(section_id) {
			var port = uci.get('snmpd', section_id, 'snmp_port');
			if (!port) {
				var s = uci.get_first('snmpd', 'agent');
				var addr = uci.get('snmpd', s['.name'], 'agentaddress');

				if (!addr)
					return null;

				addr = addr.toUpperCase();
				port = addr.match(/UDP6?:(\d+)/i);

				if (Array.isArray(port) && (port.length > 1))
					port = port[1];
			}
			return port;
		},

		go.write = L.bind(function(protocol, section_id, value) {
			var addr = [];
			var port = parseInt(value);
			var ip_protocol = protocol.formvalue(section_id);

			if (ip_protocol.match(/ipv4/g))
				addr.push('UDP:%d'.format(port));

			if (ip_protocol.match(/ipv6/g))
				addr.push('UDP6:%d'.format(port));

			if (addr.length > 0) {
				var s = uci.get_first('snmpd', 'agent');
				if (s)
					uci.set('snmpd', s['.name'], 'agentaddress', addr.join(','));
			}

			return form.Value.prototype.write.apply(this, [section_id, value]);
		}, go, this.ip_protocol);

		this.snmp_version = g.option(form.ListValue, 'snmp_version',
			_('SNMP version'),
			_('SNMP version used to monitor and control the device'));
		this.snmp_version.default = 'v1/v2c';
		this.snmp_version.rmempty = false;
		this.snmp_version.forcewrite = true;
		this.snmp_version.value('v1/v2c', _('SNMPv1 and SNMPv2c'));
		this.snmp_version.value('v1/v2c/v3', _('SNMPv1, SNMPv2c and SNMPv3'));
		this.snmp_version.value('v3', _('Only SNMPv3'));

		go = g.option(form.Value, "__agentxsocket", _("AgentX socket path"),
			_("Empty for disable AgentX"));
		go.rmempty = true;
		go.forcewrite = true;
		go.cfgvalue = function(section_id) {
			var s = uci.get_first('snmpd', 'agentx');
			var socket = uci.get('snmpd', s['.name'], 'agentxsocket');
			if (!socket)
				socket = this.default;
			return socket;
		};

		go.remove = function(section_id) {
			var s = uci.get_first('snmpd', 'agentx');
			if (s)
				s.remove('snmpd', s['.name']);
		};

		go.write = function(section_id, value) {
			var s = uci.get_first('snmpd', 'agentx');
			var sid = s ? s['.name'] : uci.add('snmpd', 'agentx');
			uci.set('snmpd', sid, 'agentxsocket', value);
		};
	},

	populateV1V2CSettings: function(subsection, desc, access, s, data) {
		var g, go, o, community, community_src, mode, mask;

		o = s.taboption('v1/v2c', form.SectionValue, '__v1/v2c__',
			form.GridSection, subsection, null, desc);

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.ListValue, 'Mode', _('Access Control'));
		go.value('rwcommunity', _('Read/Write'));
		go.value('rocommunity', _('Readonly'));

		community = g.option(form.Value, 'CommunityName',
			_('Community Name'));
		community.datatype = 'string';
		community.default = '';
		community.optional = false;
		community.rmempty = false;
		if(access == null) {
			if (uci.get('snmpd', 'access_default', 'Mode') === 'rwcommunity') {
				this.rw_community_src = 'default';
			} else {
				this.ro_community_src = 'default';
			}
		}

		if (access !== null) {
			community_src = g.option(form.Value, access,
				_('Community source'),
				_('Trusted source for SNMP read community access (hostname or IP)'));
			community_src.value('default', _('any (default'));
			community_src.value('localhost', 'localhost');
			community_src.default = 'default';
			community_src.optional = false;
			community_src.rmempty = false;
			community_src.datatype = 'host(0)';

			if (access == 'HostIP') {
				mask = g.option(form.Value, 'IPMask',
					_('IPMask'),
					_('Prefix'));
				mask.rmempty = false;
				mask.datatype = 'and(ip6prefix, ip4prefix)';
				mask.size = 2;
			}
		}

		go = g.option(form.ListValue, 'RestrictOID',
			_('OID-Restriction'));
		go.value('no', _('No'));
		go.value('yes', _('Yes'));
		go.default = 'no';
		go.optional = false;
		go.rmempty = false;

		this.oid = g.option(form.Value,
			'RestrictedOID',
			_('OID'));
		this.oid.datatype = 'string';
		this.oid.depends('RestrictOID', 'yes');

		if (go === 'rocommunity') {
			this.ro_community = community;
			this.ro_community_src = community_src;
		} else {
			this.rw_community = community;
			this.rw_community_src = community_src;
		}
	},

	populateV3Settings: function(tab, s, data){
		var g, go, o;

		o = s.taboption(tab, form.SectionValue, '__v3__',
			form.GridSection, 'v3',
			null, _('Here you can configure SNMPv3 settings'));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, 'snmp_v3_username',
			_('SNMPv3 username'),
			_('Set username to access SNMP'));
		go.rmempty = false;
		go.default = 'user';

		go = g.option(form.Flag, 'snmp_v3_allow_write',
			_('Allow write'));
		go.rmempty = false;
		go.default = '0';

		go = g.option(form.ListValue, 'snmp_v3_auth_type',
			_('SNMPv3 authentication type'));
		go.value('none', _('none'));
		go.value('SHA', _('SHA'));
		go.value('MD5', _('MD5'));
		go.rmempty = false;
		go.default = 'SHA';

		// SNMPv3 auth pass
		go = g.option(form.Value, 'snmp_v3_auth_pass',
			_('SNMPv3 authentication passphrase'));
		go.password = true;
		go.rmempty = false;
		go.default = 'passphrase';

		// SNMPv3 privacy/encryption type
		go = g.option(form.ListValue, 'snmp_v3_privacy_type',
			_('SNMPv3 encryption type'));
		go.value('none', _('none'));
		go.value('AES', _('AES'));
		go.value('DES', _('DES'));
		go.rmempty = false;
		go.default = 'AES';

		// SNMPv3 privacy/encryption pass
		go = g.option(form.Value, 'snmp_v3_privacy_pass',
			_('SNMPv3 encryption passphrase'));
		go.default = 'passphrase';
		go.password = true;

		go = g.option(form.ListValue, 'RestrictOID',
			_('OID-Restriction'));
		go.value('no', _('No'));
		go.value('yes', _('Yes'));
		go.default = 'no';
		go.optional = false;
		go.rmempty = false;

		this.oid = g.option(form.Value,
			'RestrictedOID',
			_('OID'));
		this.oid.datatype = 'string';
		this.oid.depends('RestrictOID', 'yes');
	},

	populateTrapsSettings: function(tab, s, data) {
		var trap_enable;
		var trap_snmp_version;
		var trap_host;
		var trap_port;
		var trap_community;
		var g, go, o;
		
		o = s.taboption(tab, form.SectionValue, '__traps__',
			form.TableSection, tab, null,
			_('Here you can configure Traps settings'));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		trap_enable = g.option(form.Flag, 'trap_enabled',
			_('Enable SNMP traps'),
			_('Enable SNMP trap functionality'));
		trap_enable.default = '0';
		trap_enable.rmempty = false;
		trap_enable.forcewrite = true;

		trap_enable.write = L.bind(function(o, section_id, value) {
			var t_version   = trap_snmp_version.formvalue(section_id);
			var t_enable    = value;
			var t_host      = trap_host.formvalue(section_id);
			var t_port      = trap_port.formvalue(section_id);
			var t_community = trap_community.formvalue(section_id);
			this.trapsConfigure(t_enable, t_version, t_host, t_port, t_community);
			uci.set('snmpd', section_id, o.alias || o.option, value);
		}, this, trap_enable);

		trap_snmp_version = g.option(form.ListValue, 'trap_snmp_version',
			_('SNMP traps version'),
			_('SNMP version used for sending traps'));
		trap_snmp_version.value('v1', 'SNMPv1');
		trap_snmp_version.value('v2c', 'SNMPv2c');
		trap_snmp_version.default = 'v2c';

		trap_host = g.option(form.Value, 'trap_host',
			_('Host/IP'),
			_('Host to transfer SNMP trap traffic to (hostname or IP address)'));
		trap_host.datatype = 'host(0)';
		trap_host.default = 'localhost';
		trap_host.rmempty = false;

		trap_port = g.option(form.Value, 'trap_port',
			_('Port'),
			_('Port for trap\'s host'));
		trap_port.default = '162';
		trap_port.datatype = 'port';
		trap_port.rmempty = false;

		trap_community = g.option(form.Value, 'trap_community',
			_('Community'),
			_('The SNMP community for traps'));
		trap_community.value('public');
		trap_community.value('private');
		trap_community.default = 'public';
		trap_community.rmempty = false;
	},

	populateLogSettings: function(tab, s, data) {
		var g, go, o;

		o = s.taboption(tab, form.SectionValue, '__log__',
			form.GridSection, tab, null,
			_('Here you can configure Logging settings'));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		// File logging
		go = g.option(form.Flag, 'log_file',
			_('Enable logging to file'));
		go.default = '0';
		go.rmempty = false;
		go.optional = false;

		go = g.option(form.Value, 'log_file_path',
			_('Path to log file'));
		go.default = '/var/log/snmpd.log';
		go.rmempty = false;
		go.placeholder = '/var/log/snmpd.log';
		go.depends('log_file', '1');

		go = g.option(form.ListValue, 'log_file_priority',
			_('Priority for file logging'),
			_('Will log messages of selected priority and above.'));
		go.default = 'i';
		go.value('!', 'LOG_EMERG');
		go.value('a', 'LOG_ALERT');
		go.value('c', 'LOG_CRIT');
		go.value('e', 'LOG_ERR');
		go.value('w', 'LOG_WARNING');
		go.value('n', 'LOG_NOTICE');
		go.value('i', 'LOG_INFO');
		go.value('d', 'LOG_DEBUG');
		go.depends('log_file', '1');

		// Syslog
		go = g.option(form.Flag, 'log_syslog',
			_('Enable logging to syslog'));
		go.default = '0';
		go.rmempty = false;
		go.optional = false;

		go = g.option(form.ListValue, 'log_syslog_facility',
			_('Syslog facility'));
		go.default = 'i';
		go.value('d', 'LOG_DAEMON');
		go.value('u', 'LOG_USER');
		go.value('0', 'LOG_LOCAL0');
		go.value('1', 'LOG_LOCAL1');
		go.value('2', 'LOG_LOCAL2');
		go.value('3', 'LOG_LOCAL3');
		go.value('4', 'LOG_LOCAL4');
		go.value('5', 'LOG_LOCAL5');
		go.value('6', 'LOG_LOCAL6');
		go.value('7', 'LOG_LOCAL7');
		go.depends('log_syslog', '1');

		go = g.option(form.ListValue, 'log_syslog_priority',
			_('Priority for syslog logging'),
			_('Will log messages of selected priority and above.'));
		go.default = 'i';
		go.value('!', 'LOG_EMERG');
		go.value('a', 'LOG_ALERT');
		go.value('c', 'LOG_CRIT');
		go.value('e', 'LOG_ERR');
		go.value('w', 'LOG_WARNING');
		go.value('n', 'LOG_NOTICE');
		go.value('i', 'LOG_INFO');
		go.value('d', 'LOG_DEBUG');
		go.depends('log_syslog', '1');

	},

	render: function(data) {
		var m, s, o, g, go;

		m = new form.Map("snmpd",
			_("SNMP Settings"),
			_("On this page you may configure SNMP settings"));

		s = m.section(form.TypedSection, "snmpd");
		s.anonymous = true;
		s.addremove = false;

		s.tab("general", _("SNMP - General"));

		this.populateSystemSettings('general', s, data);
		this.populateGlobalSettings('general', s, data);

		s.tab("advanced", _("Advanced Settings"));

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.TypedSection, "com2sec", null,
			_("Here you can configure com2sec options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, "secname", "secname");
		go = g.option(form.Value, "source", "source");
		go = g.option(form.Value, "community", "community");

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.TypedSection, "group", null,
			_("Here you can configure group options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, "group", "group");
		go = g.option(form.Value, "version", "version");
		go = g.option(form.Value, "secname", "secname");

		o = s.taboption("advanced", form.SectionValue, "__advanced__",
			form.TypedSection, "access", null,
			_("Here you can configure access options"));

		g = o.subsection;
		g.anonymous = true;
		g.addremove = true;

		go = g.option(form.Value, "group", "group");
		go = g.option(form.Value, "context", "context");
		go = g.option(form.Value, "version", "version");
		go = g.option(form.Value, "level", "level");
		go = g.option(form.Value, "prefix", "prefix");
		go = g.option(form.Value, "read", "read");
		go = g.option(form.Value, "write", "write");
		go = g.option(form.Value, "notify", "notify");

		s.tab("v1/v2c", _("SNMPv1/SNMPv2c"));
		this.populateV1V2CSettings('access_default', _('Communities for any hosts'), null, s, data);
		this.populateV1V2CSettings('access_HostName', _('Communities via hostname'), 'HostName', s, data);
		this.populateV1V2CSettings('access_HostIP', _('Communities via IP-Address range'), 'HostIP', s, data);

		s.tab("v3", _("SNMPv3"));
		this.populateV3Settings('v3', s, data);

		s.tab("traps", _("Traps", "SNMP"));
		this.populateTrapsSettings('traps', s, data);

		s.tab('log', _('Logging'));
		this.populateLogSettings('log', s, data);

		return m.render();
	}
});
