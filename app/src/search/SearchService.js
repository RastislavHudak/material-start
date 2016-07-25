(function(){
  'use strict';

  angular.module('search')
         .service('searchService', ['$http', SearchService]);

  function SearchService($http){

    var solr = 'http://app01.cc.univie.ac.at:8983/solr/phaidra/select';

    var tsizeGap = 20971520;

    return {

      tsizeGap: tsizeGap,

      search: function(q, start, rows, sortdef, facet_filter){

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
            'facet.field': ['resourcetype','dc_license'],
            'facet.range': ['tsize','tcreated'],
            'f.tsize.facet.range.gap':'+' + tsizeGap,
            'f.tsize.facet.range.start':0,
            'f.tsize.facet.range.end':21474836480,
            'f.tcreated.facet.range.gap':'+1YEAR',
            'f.tcreated.facet.range.start':'2008-01-01T00:00:00Z',
            'f.tcreated.facet.range.end':'NOW'            
        };

        var facets = [];
        for (var i = 0; i < facet_filter.length; i++) {
          var id = facet_filter[i].id;
          var query = facet_filter[i].query;
          if(id != 'tcreated' && id != 'tsize'){
            query = '"' + query + '"';
          }
          facets.push(id + ':' + query);
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
