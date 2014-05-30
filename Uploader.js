define(
	['jquery', 'underscore', 'backbone'],
	function($, _, Backbone){

		'use strict';

		var defaults = {uploadMaxSize: 50 * ( 1024 * 1024 ),
						postMaxSize: 60 * ( 1024 * 1024 ),
						uploadURL: '/'/*,
						beforeSend: function(xhr){},
						uploadStart: function(){},
						uploadProgress: function(percent, uploadSpeed, timeRemaining){},
						uploadSuccess: function(data){},
						uploadError: function(){}
						*/
					};	

		var Uploader = function(opts){
			//this.opts = $.extend( defaults, opts || {});
			this.opts = defaults;
			this.setOptions( opts );
			this.reset();
		};

		//Inherit form Events
		Uploader.prototype =  _.extend({}, Backbone.Events);

		Uploader.prototype.setOptions = function(opts){
			if( typeof opts !== 'undefined' && typeof opts !== 'null' ){
				this.opts = $.extend(this.opts, opts);
			}
		};

		Uploader.prototype.checkFilesize = function(file){
			if( file instanceof File && file.size <= this.opts.uploadMaxSize ){
				return true;
			}
			return false;
		};

		Uploader.prototype.reset = function(){
			this.formdata = new FormData();
			this.totalSize = 0;
			this._xhr = null;
			this._preBytesLoaded = 0;
			this._uploadStartTime = 0;
			this._uploadEndTime = 0;
			this._lastTimestamp = 0;
		};	

		Uploader.prototype.appendData = function( name, value  ){

			if( typeof name == 'string' && ( value instanceof File || typeof value == 'string' ) ){

				if( value instanceof File ){
					if( this.checkFilesize( value ) == false ){
						this.trigger('error:uploadmaxsize');
						return false;
					}

					this.totalSize += value.size;

					if( this.totalSize > this.opts.postMaxSize ){
						this.trigger('error:totalmaxsize');
						return false;
					}
				}

				this.formdata.append(name, value);

				return true;
			}

			return false;
		};

		Uploader.prototype.upload = function(){
			this._sendXHR();	
		};

		//Check Browser if can handle AJAX Uploads
		Uploader.prototype.canXHRUpload = function(){
			if( typeof File !== 'undefined' && 
				typeof FormData !== 'undefined' && 
				typeof (new XMLHttpRequest()).upload !== 'undefined'){
				return true;
			}else{
				return false;
			}
		};

		Uploader.prototype.abortUpload = function(){
			//xhr readystates: 0: UNSENT | 1: OPENED | 2: HEADERS_RECEIVED | 3: LOADING | 4: DONE
			if( this._xhr && this._xhr.readstate != 4 ){
				this._xhr.abort();
			}
		};

		Uploader.prototype._sendXHR = function(){
			var self = this;

			$.ajax({
				url:  this.opts.uploadURL,
				type: 'POST',
				data: this.formdata,
				contentType: false,
				processData: false,
				xhr: function(){

					self._xhr =  $.ajaxSettings.xhr();

					
					self._xhr.upload.addEventListener('load', function(e){

						self._preBytesLoaded = 0;
						self._uploadStartTime = Math.round( new Date().getTime() / 1000 );
						self._uploadEndTime = 0;
						self._lastTimestamp = 0;

						/*
						if( typeof self.opts.uploadStart == 'function' ){
							self.opts.uploadStart();
						}
						*/
						self.trigger('upload:start');
					});

					self._xhr.upload.addEventListener('progress', function(e){

						if( e.lengthComputable ){
							var percent = Math.round( (100 / e.total) * e.loaded );

							var currentTime = new Date().getTime();

							if( !self._lastTimestamp ) self._lastTimestamp = currentTime;

							if( self._lastTimestamp < (currentTime - 1000) ){
								var iv = currentTime - self._lastTimestamp;
								var stats = self._calculateUpload( e.loaded, e.total, iv );

								/*								
								if( typeof self.opts.uploadProgress == 'function' ){
									self.opts.uploadProgress( percent, stats.uploadSpeed, stats.secondsRemaining );
								}
								*/

								self.trigger('upload:progress', percent, stats.uploadSpeed, stats.secondsRemaining);

								self._lastTimestamp = currentTime;
							}
						}
					});	

					return self._xhr;
				},
				beforeSend: function(xhr){
					self.trigger('upload:beforesend', xhr);
					
					/*
					if( typeof self.opts.beforeSend == 'function' ){
						self.opts.beforeSend( xhr );
					}
					*/
				},
				success: function(data, textStatus, xhr){
					self.trigger('upload:success', data, textStatus, xhr);
					
					/*
					if( typeof self.opts.uploadSuccess == 'function' ){
						self.opts.uploadSuccess(data, textStatus, xhr);
					}
					*/
				},
				error:function(xhr, textStatus, errorThrown){
					self.trigger('upload:error', xhr, textStatus, errorThrown);
					
					/*
					if( typeof self.opts.uploadError == 'function' ){
						self.opts.uploadError(xhr, textStatus, errorThrown);
					}
					*/
				}
			});

		};

		Uploader.prototype._calculateUpload = function(bytesLoaded, bytesTotal, iv){
			var diff = bytesLoaded - this._preBytesLoaded;

			if(diff == 0) return;

			this._preBytesLoaded = bytesLoaded;
			//diff *= 2;
			var bytesRemaining = bytesTotal - this._preBytesLoaded;

			var secsRemaining = bytesRemaining / diff;

			diff /=  (iv / 1000);
			var speed = diff.toString() + 'B/s';
			if(diff > (1024 * 1024)){
				speed = (Math.round( diff * 100 / (1024 * 1024)) / 100).toString() + 'MB/s';
			}else if( diff > 1024 ){
				speed = (Math.round( diff * 100 / 1024 ) / 100).toString() + 'KB/s';
			}

			//var timeRemaining = this._secondsToTime(secsRemaining);

			var obj = {};
			obj.uploadSpeed = speed;
			obj.secondsRemaining = secsRemaining;

			return obj;
		};

		Uploader.prototype.convertSecondsToTime =  function (secs){
			var hour = Math.floor(secs / 3600);
			var min = Math.floor( (secs - (hour * 3600)) / 60 );
			var sec = Math.floor(secs - (hour * 3600) - (min * 60));

			if( hour < 10 ) hour = '0' + hour;
			if( min < 10) min = '0' + min;
			if( sec < 10 ) sec = '0' + sec;

			return [hour, min, sec].join(':'); 
		};

		Uploader.prototype.convertBytesToSize = function(bytes){
			var sizes = ['Bytes', 'KB', 'MB'];
			if (bytes == 0) return 'n/a';
			var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
			return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
		};

		return Uploader;

	}
);