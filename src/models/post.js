const slugify = require('@sindresorhus/slugify');
const nodePath = require('path');

const strip_filename_prefix = require('../util/strip-filename-prefix');

class Post {
	constructor({ data, content, file }) {
		// copy data over to the object
		// TODO make sure none of the data overwrites any property or method
		Object.assign(this, data);

		// ...and also make it available in .data
		this.data = data;

		// Populate content
		this.content = content;

		if (this.title) {
			this.title_slug = slugify(this.title);
		}

		this.path = file.path;
		this.directory = file.dirname;
		this.filename = strip_filename_prefix(file.stem);
		this.filename_slug = slugify(this.filename);

		this.section = this.directory.split(nodePath.sep)[0];
		if (this.section === '.') {
			this.section = 'default';
		}
	}
}

module.exports = Post;
