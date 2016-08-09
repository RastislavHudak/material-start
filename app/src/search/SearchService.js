(function(){
  'use strict';

  angular.module('search').service('searchService', ['$http', SearchService]);

  function SearchService($http){

    var solr = 'http://app01.cc.univie.ac.at:8983/solr/phaidra/select';

    var tsizeGap = 104857600;//20971520;

    var marcRoles = {
      
      "initiator": "Initiator",
      "evaluator": "Evaluator",  
      "technicalinspector": "Technical inspector",
      "textprocessor": "Textprocessor",
      "pedagogicexpert": "Pedagogic expert",
      "interpreter": "Interpreter",
      "digitiser": "Digitiser",
      "keeperoftheoriginal": "Keeper of the original",
      "adviser": "Adviser",
      "degreegrantor": "Degree grantor",
      "uploader": "Uploader",
      "dtc": "Data contributor",
      "aut": "Author",
      "pbl": "Publisher",  
      "edt": "Editor",
      "dsr": "Designer",
      "trl": "Translator",
      "exp": "Expert",
      "oth": "Other",
      "art": "Artist",
      "dnr": "Donor",
      "pht": "Photographer",
      "jud": "Judge",
      "prf": "Performer",
      "wde": "Wood engraver",
      "rce": "Recording engineer",
      "sce": "Scenarist",
      "ths": "Thesis advisor",
      "sds": "Sound designer",
      "lyr": "Lyricist",
      "ilu": "Illuminator",
      "eng": "Engineer",
      "cnd": "Conductor",
      "dto": "Dedicator",
      "opn": "Opponent",
      "cmp": "Composer",
      "ctg": "Cartographer",
      "dub": "Dubious author",
      "wam": "Writer of accompanying material",
      "arc": "Architect",
      "vdg": "Videographer",
      "scl": "Sculptor",
      "aus": "Screenwriter",
      "own": "Owner",
      "fmo": "Former owner",
      "mus": "Musician",
      "ive": "Interviewee",
      "ill": "Illustrator",
      "cng": "Cinematographer",
      "dte": "Dedicatee",
      "sad": "Scientific advisor",
      "mte": "Metal-engraver",
      "arr": "Arranger",
      "etr": "Etcher",
      "dis": "Dissertant",
      "prt": "Printer",
      "flm": "Film editor",
      "rev": "Reviewer",
      "pro": "Producer",
      "att": "Attributed name",
      "lbt": "Librettist",
      "ivr": "Interviewer",
      "egr": "Engraver",
      "msd": "Musical director",
      "ard": "Artistic director",
      "chr": "Choreographer",
      "com": "Compiler",
      "sng": "Singer",
      "act": "Actor",
      "adp": "Adapter"
    };

    return {

      tsizeGap: tsizeGap,

      marcRoles: marcRoles,

      getMarcRoleLabel: function(r){
        return marcRoles[r] ? marcRoles[r] : r;        
      },

      search: function(q, start, rows, sortdef, facet_filter, sw, ne){

        if(q == ''){
          q = '*:*';
        }

        var params = { 
            q: q,
            defType: 'edismax',
            wt: 'json',
            qf: 'pid^5 dc_title^4 dc_creator^3 dc_subject^2 _text_',
            start: start,
            rows: rows,
            sort: sortdef,
            facet: true,
            'facet.mincount':1,            
            'facet.field': ['resourcetype','dc_license', 'datastreams'],
            'facet.range': ['tsize','tcreated'],
            'f.tsize.facet.range.gap':'+' + tsizeGap,
            'f.tsize.facet.range.start':0,
            'f.tsize.facet.range.end':21474836480,
            'f.tcreated.facet.range.gap':'+1YEAR',
            'f.tcreated.facet.range.start':'2008-01-01T00:00:00Z',
            'f.tcreated.facet.range.end':'NOW'            
        };

/*
        if(pt != '' && d >= 0){
          params["fq"] = '{!bbox sfield=latlon}';
          params["d"] = d;
          params["pt"] = pt;
        }
*/

        if ((typeof sw !== 'undefined') && (typeof ne !== 'undefined')) {
          params["fq"] = 'latlon:[' + sw.lat + ',' + sw.lng + ' TO ' + ne.lat + ',' + ne.lng + ']';
        }    

        var facets = [];
        for (var i = 0; i < facet_filter.length; i++) {
          var id = facet_filter[i].id;
          var query = facet_filter[i].query;
          var sign = facet_filter[i].sign;
          if(id != 'tcreated' && id != 'tsize'){
            query = '"' + query + '"';
          }
          facets.push((sign ? sign : '') + id + ':' + query);
        }

        var facets_str = facets.join(' AND ');
        if(facets_str != '' && facets_str != ' '){
          params.q += ' AND ' + facets_str;
        }

        return $http({
          method  : 'GET',
          url     : solr,
          params  : params
        });
      }

    };
  }

})();
