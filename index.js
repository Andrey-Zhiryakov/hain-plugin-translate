'use strict';


const got = require('got');
const fs = require('fs');
const path = require('path');

module.exports = (pluginContext) => {
    const shell = pluginContext.shell;
    const toast = pluginContext.toast;
    const logger = pluginContext.logger;
    const prefObj = pluginContext.preferences;

    const pref = prefObj.get();

    const args = [
        {"argument" : "-sl" },
        {"argument" : "-tl" },
        {"argument" : "-m" },
    ];

    let html = '',
        translatedText = '';

    function startup() {
      html = fs.readFileSync(path.join(__dirname, 'render.html'), 'utf8');
    }


    function search(query, res) {
      const query_trim = query.trim();
      if (query_trim.length == 0) {
          return;
      }

      var queryParse = parseQuery(query_trim);
      var sentence = getByArg("m", queryParse);

      function addSearchResult(showPreview = true) {
        res.add([{
            id: sentence.length,
            payload: queryParse,
            title: 'Translate ' + ((sentence!= null)? sentence : "your sentence"),
            desc: 'Translate your sentence',
            icon: "#fa fa-language",
            preview: showPreview
        }]);
      }

      if (pref.asHint) {
        addSearchResult(false);
      } else {
        translate(sentence, pref.srcLng ? pref.srcLng : "en", pref.targLng ? pref.targLng : "ru").then(value => {
          translatedText = value;
          addSearchResult();
        });
      }
    }

    function execute(id, payload) {
        if (payload !== '') {
            var sourceLang = ((getByArg("sl", payload) != null)?getByArg("sl", payload): pref.srcLng ? pref.srcLng : "en");
            var targetLang = ((getByArg("tl", payload) != null)?getByArg("tl", payload): pref.targLng ? pref.targLng : "ru");
            var sourceText = ((getByArg("m", payload) != null)?getByArg("m", payload): "");
            translate(sourceText, sourceLang, targetLang).then(value => {toast.enqueue(value, 3000);});
        }else{
            return;
        }
    }

    function renderPreview(id, payload, render) {
      render(html.replace('%sentence%', translatedText));
    }



    function parseQuery(query){
        var obj = [];
        for(var i=0; i < args.length; i++){
            var pos = query.indexOf(args[i].argument);
            if(pos >= 0) {
                obj.push( {"arg": args[i].argument, "value" : getValue(args[i].argument, query) } );
            }
        }
        if(obj.length == 0){
            obj.push({"arg": "-m", "value" : query });
        }
        return obj;
    }

    function getValue(arg, query){
        var pos = query.indexOf(arg);
        if(pos != 0){
            query = query.substr(pos, query.length);
        }

        query = query.substr(arg.length, query.length);
        query = query.substr(0, posNextArg(query));

        return query.trim();
    }

    function posNextArg(query){
        var minPos = query.length;
        for(var i=0; i < args.length; i++){
            var pos = query.indexOf(args[i].argument);
            if(pos >= 0) {
                if(pos < minPos){
                    minPos = pos;
                }
            }
        }
        return minPos;
    }

    function getByArg(arg, parse){
        for(var i=0; i < parse.length; i++){
            if(parse[i].arg == "-"+arg){
                return parse[i].value;
            }
        }
        return null;
    }

    function checkStringSimilarity(sourceString, similarString) {
      var src = sourceString.split(' '),
      similarStr = similarString.split(' '),
      similar = 0,
      sourceLength = src.length;

      for (var ind in src) {
        let found = similarStr.indexOf(src[ind]);
        if (found > -1) {
          similar++;
          src.splice(ind);
          similarStr.splice(found, 1);
        }

        if (similar > src.length) {
          return true;
        }
      }

      return false;
    }

    function translate(sourceText, sourceLang, targetLang) {
      return new Promise(function(resolve, reject){
        var baseUrl = "https://translate.yandex.net/api/v1.5/tr.json/translate?key=trnsl.1.1.20160423T154320Z.a16aa24916c8947b.612925192e37ef98dcbdf46c870ee39edd74d717&text=";

        if(sourceText != ""){
            var url = baseUrl + encodeURI(sourceText)+ "&lang="+ sourceLang + "-" + targetLang;

            got(url)
            .then(response => {
                var result  = response.body;
                var data = JSON.parse(result);
                if (!checkStringSimilarity(sourceText, data.text[0])) {
                  resolve(data.text[0]);
                  return;
                } else {
                  url = baseUrl + encodeURI(sourceText)+ "&lang="+ targetLang + "-" + sourceLang;

                  got(url).then(response => {
                    var result  = response.body;
                    var data = JSON.parse(result);
                    resolve(data.text[0]);
                    return;
                  })
                  .catch(err => {
                    // toast.enqueue("An error has occurred", 2000);
                    // toast.enqueue(error.response.body, 3000);
                    reject('An error has occurred');
                    return;
                  });
                }
            })
            .catch(error => {
                // toast.enqueue("An error has occurred", 2000);
                // toast.enqueue(error.response.body, 3000);
                reject('An error has occurred');
                return;
            });
        }else{
            // toast.enqueue("You must write a sentence to translate", 3000);
            reject("You must write a sentence to translate");
            return;
        }
      });
    }

    return {startup, search, execute, renderPreview};
};
