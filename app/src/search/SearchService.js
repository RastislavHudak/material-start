(function(){
  'use strict';

  angular.module('search').service('searchService', ['$http', SearchService]);

  function SearchService($http){

    var solr = 'http://app01.cc.univie.ac.at:8983/solr/phaidra/select';

    //var tsizeGap = 104857600;

    var facetQueries = [ 
      { 
        label: "Size",
        queries: 
         [
          {
            query: 'tsize:[0 TO 10485760]',
            label: '< 10MB'
          },
          {
            query: 'tsize:[10485760 TO 52428800]',
            label: '10MB - 50MB'
          },
          {
            query: 'tsize:[52428800 TO 104857600]',
            label: '50MB - 100MB'
          },
          {
            query: 'tsize:[104857600 TO 209715200]',
            label: '100MB - 200MB'
          },
          {
            query: 'tsize:[209715200 TO 524288000]',
            label: '200MB - 500MB'
          },
          {
            query: 'tsize:[524288000 TO 1073741824]',
            label: '500MB - 1GB'
          },
          {
            query: 'tsize:[1073741824 TO *]',
            label: '> 1GB'
          }
        ]
      }
    ];

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

      //tsizeGap: tsizeGap,

      marcRoles: marcRoles,

      facetQueries: facetQueries,

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
            'facet.range': ['tcreated'],
            //'facet.range': ['tsize','tcreated'],
            //'f.tsize.facet.range.gap':'+' + tsizeGap,
            //'f.tsize.facet.range.start':0,
            //'f.tsize.facet.range.end':21474836480,
            'f.tcreated.facet.range.gap':'+1YEAR',
            'f.tcreated.facet.range.start':'2008-01-01T00:00:00Z',
            'f.tcreated.facet.range.end':'NOW'
            /*,
            'facet.query': [
              'tsize:[0 TO 10485760]', 
              'tsize:[10485760 TO 52428800]', 
              'tsize:[52428800 TO 104857600]',
              'tsize:[104857600 TO 209715200]',
              'tsize:[209715200 TO 524288000]',
              'tsize:[524288000 TO 1073741824]',
              'tsize:[1073741824 TO *]'
            ]*/
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
          if(facet_filter[i].id){
            var id = facet_filter[i].id;
            var query = facet_filter[i].query;
            var sign = facet_filter[i].sign;
            if(id != 'tcreated' && id != 'tsize'){
              query = '"' + query + '"';
            }
            facets.push((sign ? sign : '') + id + ':' + query);
          }else{
            facets.push(facet_filter[i].query);
          }
        }

        var facets_str = facets.join(' AND ');
        if(facets_str != '' && facets_str != ' '){
          params.q += ' AND ' + facets_str;
        }

        params['facet.query'] = [];
        for (var i = 0; i < facetQueries.length; i++) {
          for (var j = 0; j < facetQueries[i].queries.length; j++) {
            params['facet.query'].push(facetQueries[i].queries[j].query);
          }          
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
