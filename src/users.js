/*
	Login360 users sign-up/login functions

*/

const crypto = require('crypto');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const totpGen = require('totp-generator');
const Twilio = require('twilio');


module.exports = {
	getHash,
	validAuth,
	validEmail,
	doLogin,
	twofactorGetCode,
	twofactorSendSMS,
	signupSendEmail,
	signupContinue
};


let twilioClient, mailgunClient;


// getHash( cfg, text ): string
function getHash( cfg, text ) {

	const a = crypto.createHmac('sha256', cfg.salt);
	const h = a.update(text).digest('hex');
	return h;
}


// validAuth( users: Store, auth: string ): id? -must: one exists
function validAuth( users, auth ) {

	if ( !auth || auth.length !== 64 ) { // sha-256
		return 0;
	}
	const [err, current] = users.current(auth, 'auth');
	if (err || !current.auth) {
		return 0;
	}
	return current.id;
}


// validEmail( email ): bool -must: name@host.tld
function validEmail( email ) {

	const p = (email || '').split('@');
	const d = p.length === 2 ? p[1].split('.') : [];
	return d.length > 1 && d.every(e => e.length);
}


// doLogin( users: Store, id ): [err?, auth?]
// set auth = hash ( id )
function doLogin( cfg, users, id ) {

	const tnow = (new Date).getTime();
	const auth = getHash( cfg, tnow +'--'+ id );

	const [err] = users.update(id, { auth });
	return err ? [err] : ['', auth];
}


// twofactorGetCode( cfg ): string -Time-based OTP
function twofactorGetCode( cfg, uname ) {

	const base = cfg.otpSeed + uname.toUpperCase().replace(/[^2-7A-Z]+/g, '');
	const otp = totpGen(base, { period: cfg.otpTimeout });
	return otp;
}


// twofactorSendSMS( cfg, phone, otp ): promise
function twofactorSendSMS( cfg, phone, otp ) {

	if ( !twilioClient ) {
		twilioClient = Twilio(cfg.twilioSid, cfg.twilioToken);
	}
	const data = {
		body: `Login360 2FA code: ${otp}`,
		from: cfg.twilioPhone,
		to: phone
	};
	const send = twilioClient.messages.create(data);
	return send;
}


// signupSendEmail( cfg, secret ): promise
// send to email containing link to callback url
function signupSendEmail( cfg, email, cburl ) {

	if ( !mailgunClient ) {
		const mailgun = new Mailgun(formData);
		mailgunClient = mailgun.client({ username: 'api', key: cfg.mgKey });
	}

	const html = `<p>Thank you for joining Login360 application.</p>
	<a href="${cburl}" title="Finish">Click here to finish sign-up</a><br/>`;
	// text-only clients
	const text = `Thank you for joining Login360 application.
	Use this URL to finish sign-up: ${cburl}`;

	const data = {
		from: cfg.mailFrom,
		to: email,
		subject: 'Login360 sign-up',
		text,
		html
	};
	const send = mailgunClient.messages.create(cfg.mgDomain, data);
	return send;
}


// signupContinue( row, timeout ): bool
function signupContinue( row, timeout ) {

	if ( !timeout ) { // 0==disabled
		return true;
	}
	if ( !row.created || typeof row.created !== 'number' ) {
		return false;
	}
	const tnow = (new Date).getTime();
	return tnow < (timeout * 1000 + row.created);
}
