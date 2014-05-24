'use strict';
var optimize = require('amd-optimizer');
var gutil = require('gulp-util');
var through = require('through');
var fs = require('fs');

var File = gutil.File;
var Buffer = require('buffer').Buffer;
var PluginError = gutil.PluginError;
var baseName = /^(.*?)\.\w+$/;
var windowsBackslash = /\\/g;


function loadFile(path, name){
  return {
    name: name,
    path: path,
    source: fs.readFileSync(path).toString('utf8')
  };
}



function isExcluded(config, name){
  return config.exclude && config.exclude.some(function(exclude){
    if(name[exclude.length-1] == '/'){
      return name.indexOf(exclude) === 0;
    }else{
      return name == exclude;
    }
  });
}






module.exports = function (config) {
  
  if(config == undefined || 'baseUrl' in config == false){
    throw new PluginError('gulp-amd-optimize', 'baseUrl is required in the config');
  }
  
  var sourceMapSupport = false;
  var cwd;
  
  var optimizer = optimize(config);

  optimizer.on('dependency', function(dependency){
    if(isExcluded(config, dependency.name)){
      return;
    }
    optimizer.addFile(loadFile(dependency.url, dependency.name))
  });
  
  function onData(file) {
    if (file.isNull()) {
      this.push(file);
    }
    
    if(file.sourceMap){
      sourceMapSupport = true;
    }

    if (file.isStream()) {
      this.emit('error', new PluginError('gulp-amd-optimize', 'Streaming not supported'));
      return
    }
    
    cwd = file.cwd;
    
    optimizer.addFile({
      source: file.contents.toString('utf8'),
      path: file.path,
      name: baseName.exec(file.relative.replace(windowsBackslash, "/"))[1]
    });
    
  }
  
  function onEnd(){
    
    var output = optimizer.optimize();
            
    output.forEach(function(module){
            
      if(module.code == undefined){
        if(!isExcluded(config, module.name)){
          console.warn('missing module', module.name);
        }
        return;
      }
      
      var file = new File({
        path: cwd+'/'+config.baseUrl + module.name + '.js',
        base: cwd+'/'+config.baseUrl,
        cwd: cwd,
        contents: new Buffer(module.code+'\n\n')
      });
      
      if(sourceMapSupport){
        module.map.sourcesContent = [module.source];
        
        file.sourceMap = module.map;
      }
      
      this.queue(file);
    }.bind(this));
    
    this.queue(null);
        
  }
  
  return through(onData, onEnd);
};