define(function (require) {

	var elgg = require('elgg');
	var $ = require('jquery');
	require('https://cdnjs.cloudflare.com/ajax/libs/dropzone/5.5.1/dropzone-amd-module.js');

	var dz = {
		/**
		 * Initialize dropzone on DOM ready
		 * @returns {void}
		 */
		init: function () {

			var init = 'initialize.dropzone init.dropzone ready.dropzone';
			var reset = 'reset.dropzone clear.dropzone';

			$(document).off('.dropzone');

			$(document).on(init, '.elgg-input-dropzone', dz.initDropzone);
			$(document).on(reset, '.elgg-input-dropzone', dz.resetDropzone);

			$(document).on(init, 'form:has(.elgg-input-dropzone)', dz.initDropzoneForm);
			$(document).on(reset, 'form:has(.elgg-input-dropzone)', dz.resetDropzoneForm);

			$('.elgg-input-dropzone').trigger('initialize');
		},
		/**
		 * Configuration parameters of the dropzone instance
		 * @param {String} hook
		 * @param {String} type
		 * @param {Object} params
		 * @param {Object} config
		 * @returns {Object}
		 */
		config: function (hook, type, params, config) {

			var defaults = {
				url: elgg.security.addToken(elgg.get_site_url() + 'action/dropzone/upload'),
				method: 'POST',
				headers: {
					'X-Requested-With': 'XMLHttpRequest'
				},
				parallelUploads: 10,
				paramName: 'dropzone',
				uploadMultiple: true,
				createImageThumbnails: true,
				thumbnailWidth: 200,
				thumbnailHeight: 200,
				maxFiles: 10,
				addRemoveLinks: false,
				dictRemoveFile: "&times;",
				previewTemplate: params.dropzone.closest('.elgg-dropzone').find('[data-template]').children()[0].outerHTML,
				fallback: dz.fallback,
				//autoProcessQueue: false,
				init: function () {
					if (this.options.uploadMultiple) {
						this.on('successmultiple', dz.success);
					} else {
						this.on('success', dz.success);
					}
					this.on('addedfile', dz.backuprequired); 
					this.on('removedfile', dz.removedfile);
					this.on('removedfile', dz.restorerequired);
				}
				//forceFallback: true
			};

			return $.extend(true, defaults, config);
		},
		/**
		 * Callback function for 'initialize', 'init', 'ready' event
		 * @param {Object} e
		 * @returns {void}
		 */
		initDropzone: function (e) {

			var $input = $(this);

			if ($input.data('elgg-dropzone')) {
				return;
			}

			var params = elgg.trigger_hook('config', 'dropzone', {dropzone: $input}, $input.data());

			//These will be sent as a URL query and will be available in the action
			var queryData = {
				container_guid: $input.data('containerGuid'),
				input_name: $input.data('name'),
				subtype: $input.data('subtype')
			};

			var parts = elgg.parse_url(params.url),
					args = {}, base = '';
			if (typeof parts['host'] === 'undefined') {
				if (params.url.indexOf('?') === 0) {
					base = '?';
					args = elgg.parse_str(parts['query']);
				}
			} else {
				if (typeof parts['query'] !== 'undefined') {
					args = elgg.parse_str(parts['query']);
				}
				var split = params.url.split('?');
				base = split[0] + '?';
			}

			$.extend(true, args, queryData);
			params.url = base + $.param(args);

			$input.dropzone(params);
			$input.data('elgg-dropzone', true);
		},
		/**
		 * Callback function for 'reset' event
		 * @param {Object} e
		 * @returns {void}
		 */
		resetDropzone: function (e) {
			$(this).find('.elgg-dropzone-preview').remove();
		},
		/**
		 * Callback to initialize dropzone on form 'initialize' and 'ready' events
		 * @param {Object} e
		 * @returns {void}
		 */
		initDropzoneForm: function (e) {
			if (!$(e.target).is('.elgg-input-dropzone')) {
				$(this).find('.elgg-input-dropzone').trigger('initialize');
			}
		},
		/**
		 * Callback to reset dropzone on form 'reset' and 'clear' events
		 * @param {Object} e
		 * @returns {void}
		 */
		resetDropzoneForm: function (e) {
			if (!$(e.target).is('.elgg-input-dropzone')) {
				$(this).find('.elgg-input-dropzone').trigger('reset');
			}
		},
		/**
		 * Display regular file input in case drag&drop is not supported
		 * @returns {void}
		 */
		fallback: function () {
			$('.elgg-dropzone').hide();
			$('input[data-dropzone-fallback]').removeClass('hidden');
		},
		/**
		 * Files have been successfully uploaded
		 * @param {Array} files
		 * @param {Object} data
		 * @returns {void}
		 */
		success: function (files, data) {

			if (!$.isArray(files)) {
				files = [files];
			}
			$.each(files, function (index, file) {
				var preview = file.previewElement;
				if (data && data.output && data.output.length) {
					var filedata = data.output[index];
					if (filedata.success) {
						$(preview).addClass('elgg-dropzone-success').removeClass('elgg-dropzone-error');
					} else {
						$(preview).addClass('elgg-dropzone-error').removeClass('elgg-dropzone-success');
					}
					if (filedata.html) {
						$(preview).append($(filedata.html));
					}
					if (filedata.guid) {
						$(preview).attr('data-guid', filedata.guid);
					}
					if (filedata.messages.length) {
						$(preview).find('.elgg-dropzone-messages').html(filedata.messages.join('<br />'));
					}
				} else {
					$(preview).addClass('elgg-dropzone-error').removeClass('elgg-dropzone-success');
					$(preview).find('.elgg-dropzone-messages').html(elgg.echo('dropzone:server_side_error'));
				}
				elgg.trigger_hook('upload:success', 'dropzone', {file: file, data: data});
			});
		},
		/**
		 * Delete file entities if upload has completed
		 * @param {Object} file
		 * @returns {void}
		 */
		removedfile: function (file) {

			var preview = file.previewElement;
			var guid = $(preview).data('guid');

			if (guid) {
				elgg.action('action/file/delete', {
					data: {
						guid: guid
					}
				});
			}
		},
		/**
		 * @returns {void}
		 */
		backuprequired: function () {
			$input = $(this.element).parent().next('.elgg-input-dropzone-file');
			if (!$input.prop('required')) {
				return;
			}
			
			$input.data('wasRequired', true);
			$input.prop('required', false);
			$input.get(0).setCustomValidity('');
		},
		/**
		 * @returns {void}
		 */
		restorerequired: function () {
			$input = $(this.element).parent().next('.elgg-input-dropzone-file');
			if (!$input.data('wasRequired')) {
				return;
			}
			
			if (this.files.length) {
				return;
			}
						
			$input.prop('required', true);
		}
	};

	elgg.register_hook_handler('config', 'dropzone', dz.config);

	dz.init();

	return dz;
});
