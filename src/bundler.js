// Libs
const fs = require('fs-extra');
const path = require('path');
const in_cwd = require('is-path-in-cwd');
const fg = require('fast-glob');

// Modules
const config = require('./config');
const renderer = require('./templates/renderer');
const render_single = require('./templates/render-single');
const render_list = require('./templates/render-list');
const error_dist_dir = require('./errors/dist-dir');
const permalinks_single = require('./permalinks/single');
const permalinks_list = require('./permalinks/list');
const data_read = require('./data/read');
const content_read = require('./content/read');
const group_by = require('./util/group-by');
const add_async_filter = require('./util/add-async-filter');

// Models
const Post = require('./models/post');
const List = require('./models/list');

const default_options = {
	// whether to include drafts in the build
	drafts: false
};

class Bundler {
	constructor(cfg) {
		this.config = cfg;
		this.site = {
			link: this.config.base
		};

		this.renderer = renderer(this.config);
	}

	async run(opts) {
		let options = {
			...default_options,
			...opts
		};

		await this.load_filters();

		this.data = (await data_read(this.config.dataDir)).reduce(
			(res, f) => ((res[f.stem] = f.data), res),
			{}
		);

		let posts = (await content_read(this.config.contentDir))
			.map(p => {
				let post = new Post(p);
				if (post.permalink === undefined) {
					post.permalink = permalinks_single(post, this.config);
				}
				return post;
			})
			.filter(
				post =>
					post.permalink !== false && (!post.draft || options.drafts)
			);

		let lists = this.config.lists.reduce(
			(res, t) =>
				res.concat(
					group_by(posts, t.from)
						.map(
							term =>
								new List({
									taxonomy: t.from,
									term: term[0],
									posts: term[1]
								})
						)
						.filter(
							l =>
								l.posts.length &&
								(t.include__undefined ||
									l.term !== '__undefined__')
						)
				),
			[]
		);

		// Render the individual posts
		await Promise.all(
			posts.map(async post => {
				post.__rendered = await render_single(
					this.renderer,
					{
						post,
						site: this.site,
						data: this.data
					},
					this.config
				);
			})
		);

		// Render post lists

		let collections = (await Promise.all(
			Object.keys(sections).map(async section => {
				// don't render the default section list
				return section === '__undefined__'
					? null
					: {
							permalink: permalinks_list(section, this.config),
							__rendered: await render_list(
								this.renderer,
								{
									posts: sections[section].posts.sort(
										(a, b) => a.date - b.date
									),
									site: this.site,
									data: this.data
								},
								this.config
							)
					  };
			})
		)).filter(c => c);

		if (!in_cwd(this.config.distDir)) {
			throw Error(error_dist_dir(this.config.distDir));
		}

		/*
			Clean up the `dist` dir
		 */
		await fs.emptyDir(this.config.distDir);

		// Copy the `static` folder over to `dist`
		if (fs.existsSync(this.config.staticDir)) {
			fs.copy(this.config.staticDir, this.config.distDir);
		}

		// Write collections and posts to disk
		collections
			.concat(posts)
			.forEach(entry =>
				this.write_page(entry.permalink, entry.__rendered)
			);
	}

	async write_page(permalink, content) {
		/*
			If the permalink ends in '.html',
			don't append the '/index.html' part.

			This lets us write files like 404.html on the disk.
		 */
		let output_path = permalink.match(/\.html$/)
			? permalink
			: path.join(permalink, 'index.html');
		fs.outputFile(path.join(this.config.distDir, output_path), content);
	}

	async load_filters() {
		let default_filters = await fg('*.js', {
			cwd: path.resolve(__dirname, 'filters')
		}).then(filepaths =>
			filepaths.map(filepath => ({
				name: filepath.replace(/\.js$/, ''),
				func: require(`./filters/${filepath}`)
			}))
		);

		let custom_filters = await fg('*.js', {
			cwd: this.config.filterDir
		}).then(filepaths =>
			filepaths.map(filepath => ({
				name: filepath.replace(/\.js$/, ''),
				func: require(path.resolve(
					process.cwd(),
					this.config.filterDir,
					filepath
				))
			}))
		);

		default_filters
			.concat(custom_filters)
			.map(f => add_async_filter(this.renderer, f));
	}
}

module.exports = Bundler;
