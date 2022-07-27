/*
	libstore.open( name ): Store
	store table == [row] in memory, process life-time
	- operations are not serialized!
	- automatic id field ++autoincrement
	- other fields -schema is managed by client code
	- field value types: bool, string, number !(object, array, null)

	Store.methods:
	- exists( s, fl=uname ): bool
	- current( s, fl )
	- find( s, fl, inexact=false )
	- insert( row )
	- update( id, change )
	- remove( id )

	Methods return [ error, result ] (except exists)
	- error or empty on success
	- result is id or [row] or none

*/



module.exports = { open };

//
const _stores = {};

// create or open table
function open( name ) {

	if ( !name || typeof name !== 'string' ) {
		throw new Error('Invalid store name');
	}
	if ( !_stores.hasOwnProperty(name) ) {
		_stores[name] = new Store();
	}
	return _stores[name];
};


//
class Store {

	constructor() {
		this.rows = [];
		this.autoid = 0;
		this.types = ['string','number','bigint','boolean'];
	}


	// helper!
	// row: must be object with some fields
	// fields: only primitive types
	// return error
	checkRow( row ) {

		if (row === null || typeof row !== 'object' ||
			Object.keys(row).length < 1) {
			return 'Invalid row';
		}

		for (let key of Object.keys(row)) {
			const val = row[key];
			if ( !this.types.includes(typeof val) ) {
				return 'Invalid type of field '+ key;
			}
		}
		return '';
	}


	// add new, result is id
	insert( row ) {

		const err = this.checkRow(row);
		if (err) {
			return [err];
		}
		const id = this.autoid += 1;
		this.rows.push( Object.assign(row, { id }) );
		return ['', id];
	}


	// merge change, no result
	update( id, change ) {

		if ( !id ) {
			return ['Invalid id'];
		}
		const [err2, exists, x] = this.find(id);
		if (err2) {
			return [err2];
		}
		if (exists.length !== 1) {
			return ['None or duplicate id '+ id];
		}

		const err = this.checkRow(change);
		if (err) {
			return [err];
		}
		delete change.id;

		this.rows[x] = Object.assign(this.rows[x], change);
		return [''];
	}


	// delete by id, no result
	remove( id ) {

		if ( !id ) {
			return ['Invalid id'];
		}
		const [err2, exists, x] = this.find(id);
		if (err2) {
			return [err2];
		}
		if (exists.length !== 1) {
			return ['None or duplicate id '+ id];
		}

		this.rows.splice(x, 1);
		return [''];
	}


	// find( s, fl=id, inexact=false ) -> [ err, [row], lastx ]
	// inexact = true = string contains, ci
	// lastx is used in update, remove
	find( s, fl, inexact ) {

		if ( !this.types.includes(typeof s) || (typeof s === 'string' && !s) ||
			(fl && typeof fl !== 'string') ) {
			return ['Invalid search'];
		}
		fl = fl ? fl : 'id';
		inexact = typeof s !== 'string' ? false : !!inexact;

		const found = [];
		let lastx = 0;
		for (let i=0; i < this.rows.length; i++) {
			const row = this.rows[i];
			if ( !row.hasOwnProperty(fl) ) {
				continue;
			}
			const v = row[fl];
			if ( inexact &&
				(v.toString()).toLowerCase().includes(s.toLowerCase()) ) {
				found.push(row);
			}
			else if (v === s) {
				found.push(row);
				lastx = i;
			}
		}
		return ['', found, lastx];
	}


	// only one by field
	current( s, fl ) {

		const [err, rows] = this.find(s, fl);
		if (err) {
			return [err];
		}
		else if ( !Array.isArray(rows) || rows.length !== 1 ) {
			return ['None or duplicate'];
		}
		return ['', rows[0]];
	}


	// true == exists by uname or other field
	exists( s, fl ) {

		const [err, rows] = this.find(s, fl || 'uname');
		if (err) {
			console.log(err);
			return true;
		}
		return !!rows.length;
	}
}
