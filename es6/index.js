import net from 'net';
import {EventEmitter} from 'events';

import Promise from 'bluebird';
import byline from 'byline';

import ENUM from './enum';
import utils from './utils';

class TS3 extends EventEmitter {
	constructor(host = 'localhost', port = 10011, options = {}) {
		super(EventEmitter);
		this.host = host;
		this.port = port;
		this.options = options;

		this.socket = net.connect(this.port, this.host);
		this.connected = new Promise(resolve => {
			this.socket.on('connect', () => resolve());
		}).then(() => {
			this.reader = byline.createStream(this.socket, {encoding: 'utf-8', keepEmptyLines: false});
			this.reader.on('data', this.onData.bind(this));
		});

		this._openRequests = 0;
		this._promiseChain = this.connected;
		this._skippedWelcome = -2;
	}
	onData(line) {
		this._openRequests--;
		if(!this._openRequests) this._promiseChain = this.connected;
		if(this._skippedWelcome < 0) {
			this._skippedWelcome++;
			return;
		}
		line = line.trim();
		if(line.indexOf("error") !== -1) {
			let response = utils.parseResponse(line);
			if(response.error && response.id !== 0) {
				response.command = this.promise.command;
				this.promise.reject(response);
			} else {
				this.promise.resolve(response);
			}
		} else if (line.indexOf("notify") !== -1) {
			let notification = line.substr('notify'.length);
			this.emit(notification.substr(notification, notification.indexOf(" ")), utils.parseResponse(line));
			this.emit('*', utils.parseResponse(line));
		} else {
			this.promise.resolve(utils.parseResponse(line));
		}
	}
	send(command, data = {}) {
		this._openRequests++;
		this._promiseChain = this._promiseChain.then(() => {
			return new Promise((resolve, reject) => {
				this.promise = {resolve, reject, command};
				this.socket.write(`${utils.buildCommand(command, data)}\n`);
			});
		});
		return this._promiseChain;
	}
	authenticate(username, password) {
		return this.send('login', [username, password]);
	}
}

export const HostMessageMode = new ENUM({
	LOG: {value: 1},
	MODAL: {value: 2},
	MODALQUIT: {value: 3}
});

export const TextMessageTargetMode = new ENUM({
	CLIENT: {value: 1},
	CHANNEL: {value: 2},
	SERVER: {value: 3}
});

export const LogLevel = new ENUM({
	ERROR: {value: 1},
	WARNING: {value: 2},
	DEBUG: {value: 3},
	INFO: {value: 4}
});

export const ReasonIdentifier = new ENUM({
	KICK_CHANNEL: {value: 4},
	KICK_SERVER: {value: 5}
});

export const PermissionGroupTypes = new ENUM({
	SERVERGROUP: {value: 0},
	GLOBALCLIENT: {value: 1},
	CHANNEL: {value: 2},
	CHANNELGROUP: {value: 3},
	CHANNELCLIENT: {value: 4}
});

export const TokenType = new ENUM({
	SERVERGROUP: {value: 0},
	CHANNELGROUP: {value: 1}
});

export {TS3 as Client};