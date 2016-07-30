(function(){




  angular
       .module('search')
       .filter('bytes', function() {
          return function(bytes, precision) {
            if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
            if (typeof precision === 'undefined') precision = 1;
            var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
              number = Math.floor(Math.log(bytes) / Math.log(1024));
            return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) +  ' ' + units[number];
          }
        })
       .filter('capitalize', function() {
          return function(input) {
            return (!!input) ? input.charAt(0).toUpperCase() + input.substr(1).toLowerCase() : '';
          }
       })
       .controller('SearchController', [
          '$scope', 'searchService', '$mdSidenav', '$mdBottomSheet', '$timeout', '$log', '$filter', 'leafletData', 'leafletBoundsHelpers',
          SearchController
       ])
       .controller('PreviewController', [
          '$mdSidenav', '$timeout', '$log',
          PreviewController
       ]);


  function PreviewController( $mdSidenav, $mdBottomSheet, $timeout, $log ) {
    var self = this;
    self.close   = close;

    function close() {
      $mdSidenav('preview').close()
        .then(function () {
      
      });
    }

   

   
  }

  /**
   * Main Controller for the Angular Material Starter App
   * @param $scope
   * @param $mdSidenav
   * @param avatarsService
   * @constructor
   */
  function SearchController( $scope, searchService, $mdSidenav, $mdBottomSheet, $timeout, $log, $filter, leafletData, leafletBoundsHelpers ) {
    var self = this;

    self.togglePreview = buildToggler('preview');
    self.isOpenPreview = function(){
      return $mdSidenav('preview').isOpen();
    };

    self.q = '';
    self.selected     = null;
    self.docs        = [ ];
    self.search  = search;
    self.enterSearch = enterSearch;
    self.numFound = 0;
    self.start = 0;
    self.rows = 20;
    self.sortdef = '';    
    self.facet_counts = null;
    self.facets = [];
    self.facet_filter = [];
    self.selectedFilter = null;
    self.filterSearchText = null;
    self.addFacet = addFacet;
    self.getFacetFilterLabel = getFacetFilterLabel;
    self.showFacetValue = showFacetValue;
    self.formatFacetValue = formatFacetValue;
    self.removeFacetFilter = removeFacetFilter;  
    self.refreshMap = refreshMap;
    self.searchSpatial = searchSpatial;
    self.spatialNumFound = 0;
    self.center = {
      lat: 48.208384,
      lng: 16.373464,
      zoom: 4
    }
    self.pt = self.center.lat + ',' + self.center.lng;
    self.d = 4000;

    function refreshMap (){
      leafletData.getMap().then(function(map) {
        map.invalidateSize();   
        self.searchSpatial();    
      });      
    }

    self.markers = {};
    /*
      m1: {
        lat: 59.91,
        lng: 10.75,
        message: "I want to travel here!",
        focus: true,
        draggable: false
      }
    }
*/

    self.bytesFilter = $filter('bytes');
    self.dateFilter = $filter('date');

    self.facetLabels = {
      resourcetype: "Resource type",
      dc_license: "License",
      tcreated: "Created",
      tsize: "Size"
    };

    self.resourcetypeLabels = {
      image: "Image",
      book: "Book",
      journalarticle: "Journal article",
      text: "Text",
      collection: "Collection",
      video: "Viedo",
      other: "Other",
      dataset: "Dataset",
      map: "Map",
      interactiveresource: "Resource",
      sound: "Sound"
    };

    var DynamicItems = function() {
      this.loadedPages = {};
      /** @type {number} Total number of items. */
      this.numItems = 0;

      this.PAGE_SIZE = 50;               
    };
    
    DynamicItems.prototype.getItemAtIndex = function(index) {
      var pageNumber = Math.floor(index / this.PAGE_SIZE);
      var page = this.loadedPages[pageNumber];
      if (page) {
        return page[index % this.PAGE_SIZE];
      } else if (page !== null) {            
        this.fetchPage_(pageNumber);
      }
    };
    //db.getCollection('index').update({},{$rename: { 'latlong' : 'latlon'}},{ multi: 1})
    DynamicItems.prototype.getLength = function() {
      return this.numItems;
    };
    
    DynamicItems.prototype.fetchPage_ = function(pageNumber) {
    
      this.loadedPages[pageNumber] = null;    
      
      var promise = searchService.search(self.q, pageNumber * this.PAGE_SIZE, this.PAGE_SIZE, self.sortdef, self.facet_filter);      
      promise.then(
        function(response) {
          self.dynamicItems.loadedPages[pageNumber] = [];   
          //self.docs = response.data.response.docs;
          for (var i = 0; i < response.data.response.docs.length; i++) { 
            response.data.response.docs[i]['pos'] = (pageNumber * self.dynamicItems.PAGE_SIZE) + i;
            self.dynamicItems.loadedPages[pageNumber].push(response.data.response.docs[i]);
          }
          self.dynamicItems.numItems = response.data.response.numFound;
          //self.numFound = response.data.response.numFound;
          self.facet_counts = response.data.facet_counts;
          self.facets = [];
                
          Object.keys(self.facet_counts.facet_fields).forEach(function(key,index) {
            var facet = {
              field: key,
              label: self.facetLabels[key],
              counts: []
            }
            for (var i = 0; i < self.facet_counts.facet_fields[key].length; i=i+2) {  
              facet.counts.push({ 
                value: self.facet_counts.facet_fields[key][i],
                label: self.formatFacetValue(key, self.facet_counts.facet_fields[key][i]),
                count: self.facet_counts.facet_fields[key][i+1]
              });
            }
            self.facets.push(facet);
          });

          Object.keys(self.facet_counts.facet_ranges).forEach(function(key,index) {
            var facet = {
              field: key,
              label: self.facetLabels[key],
              counts: []
            }
            for (var i = 0; i < self.facet_counts.facet_ranges[key].counts.length; i=i+2) {                  
              facet.counts.push({ 
                value: self.facet_counts.facet_ranges[key].counts[i],
                label: self.formatFacetValue(key, self.facet_counts.facet_ranges[key].counts[i]),
                count: self.facet_counts.facet_ranges[key].counts[i+1]
              });
            }
            self.facets.push(facet);
          });
        }
        ,function(response) {
          $log.debug('Error:' + response.status);
        }
      );              
    };
    
    function search() {
      self.dynamicItems.fetchPage_(0);
    }
    self.dynamicItems = new DynamicItems(); 

    function searchSpatial() {        
      var limit = 10;
      var promise = searchService.search(self.q, 0, limit, null, self.facet_filter, self.pt, self.d);    
      promise.then(
        function(response) {
          self.markers = {}; 
          for (var i = 0; i < response.data.response.docs.length; i++) { 
            var doc = response.data.response.docs[i];
            self.markers[i] = {
              lat: doc.latlon_0_coordinate,
              lng: doc.latlon_1_coordinate,
              message: doc.dc_title[0],
              focus: false,
              draggable: false
            }            
          }
          self.spatialNumFound = response.data.response.numFound;     
          if(self.spatialNumFound > limit){
            alert('Too many objects were found! Please zoom your map.');
          }
        }
        ,function(response) {
          $log.debug('Error:' + response.status);
        }
      );  
    }

    self.q = 'byzanz';
    self.search();

    function getFacetFilterLabel(ff){
      return self.formatFacetValue(ff.id, ff.value);      
    }

    function buildToggler(navID) {
      return function() {
        // Component lookup should always be available since we are not using `ng-if`
        $mdSidenav(navID)
          .toggle()
          .then(function () {
            
          });
      }
    }

    function removeFacetFilter(f){
      var index = self.facet_filter.indexOf(f);
      self.facet_filter.splice(index, 1);
      self.search();
    }

    function showFacetValue(field, value){
      if(field == 'dc_license'){
        if(
            (value.indexOf('All') < 0) && 
            (value.indexOf('CC') < 0) && 
            (value.indexOf('GPL') < 0) && 
            (value.indexOf('Public') < 0)
          ){
          return false;
        }
      }

      return true;
    }

    function formatFacetValue(field, value){
      if(field == 'tcreated'){
        return self.dateFilter(value, "yyyy");
      }
      if(field == 'tsize'){                
          return (value == 0 ? "0 MB" : self.bytesFilter(value)) + ' - ' + self.bytesFilter(value*1 + searchService.tsizeGap);
      }
      if(field == 'resourcetype'){
        return self.resourcetypeLabels[value];
      }
      return value;
    }

    function addFacet(field, value) {

      var query;
      if(field == 'tcreated'){
        //2008-01-01T00:00:00Z
         query = '[' + value + ' TO ' + value + '+1YEAR]';
      }else{
        if(field == 'tsize'){
          query = '[' + value + ' TO ' + (value*1 + searchService.tsizeGap) + ']';
        }else{
          query = value;    
        }  
      }   

      var found = 0;
      for (var i = 0; i < self.facet_filter.length; i++) {
        if(self.facet_filter[i].id == field){
          self.facet_filter[i].query = query;
          self.facet_filter[i].value = value;
          found = 1;
        }
      }

      if(!found){
        self.facet_filter.push({ id: field, query: query, value: value });
      }

      self.search();
    }

    function enterSearch(keyEvent) {
      if (keyEvent.which === 13){
        self.search();
      }
    }

    function isLicense(val){
      $log.debug('facet: ' + val);
      return val.indexOf('All') > -1;
    }

  

  }

})();
