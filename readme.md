# Login360

Users sign-up and login node http service


## Endopins

1. No auth
	- /signup/
	- /signup/verifymail
	- /login
2. Two-factor
	- /twofactor/
	- /twofactor/entercode
3. Require auth
	- /changepass
	- /logout


## E-mail Verification Question ?

Currently, verifymail is implemented as POST per specification.

After verification is sent, user must open e-mail and click the link.
Since user can act ONLY on links in e-mail HTML (no forms there),
- is POST to verifymail produced with something outside this service?
- or verifymail can/must be GET endpoint for link in e-mail?



## Data

In "users" table, fields:
- uname: string -same as email !!
- email: string
- passwd: string -hashed server-side
- auth: string -if authenticated or empty
- phone: string -2FA
- preauth: string -2FA

Sign-up requests in "pending" table, fields:
- uname: string -same as email !!
- email: string
- passwd: string -hashed server-side
- secret: string
- created: number -for mail timeout in ms


## Password hashing side ?

Password for login, signup, changepass (old and new), can be clear text:
- production needs HTTPS, not client-side hashing
- stored only as hashed with salt server-side
- CAN be sent as hashed client-side -if uniform hashing for all requests is used


## Two-factor Authentication

Simple login requires uname and passwd values, returns auth value.

Separate router is used for 2FA and it has two steps.
Endpoint /twofactor/ requires uname, passwd and phone values
(can reuse old phone value), sends otp sms and returns sms id.
Auth value is prepared as preauth.
Then second request must be made to /twofactor/entercode (before timeout)
with otp and uname values, and this returns auth value.


## Configuration & Keys

File .env must be present alongside index.js (copy src/example.env).
Any variable without default must have value.


## Starting & Logging

- workdir/install: `npm i`
- workdir/start: `node index`
- with/log: `node index > app.log 2>&1`

Logging with console.error (to stderr) is not used,
to have all messages and steps in sequence with error lines.



##
