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
          '$scope', 'searchService', '$mdSidenav', '$mdBottomSheet', '$timeout', '$log', '$filter', 'leafletData', 'leafletBoundsHelpers', 'leafletMapEvents',
          SearchController
       ]);


  function SearchController( $scope, searchService, $mdSidenav, $mdBottomSheet, $timeout, $log, $filter, leafletData, leafletBoundsHelpers, leafletMapEvents ) {
    var self = this;

    self.togglePreview = buildToggler('preview');
    self.isOpenPreview = function(){
      return $mdSidenav('preview').isOpen();
    };

    self.q = '';
    self.search  = search;
    self.enterSearch = enterSearch;
    self.numFound = 0;
    self.start = 0;
    self.rows = 20;
    self.sortdef = '';    
    self.facet_counts = null;    
    self.facets = [];
    self.facet_filter = [];
    self.filterSearchText = null;
    self.addFacet = addFacet;
    self.getFacetFilterLabel = getFacetFilterLabel;
    self.showFacetValue = showFacetValue;
    self.formatFacetValue = formatFacetValue;
    self.removeFacetFilter = removeFacetFilter;  
    self.refreshMap = refreshMap;
    self.searchSpatial = searchSpatial;
    self.spatialDocs = [];
    self.markers = [];
    self.spatialNumFound = 0;
    self.pt = null;
    self.d = null;
    self.spatialNumFoundLimit = 500;
    self.selectDoc = null;
    self.getSelectDocRoles = getSelectDocRoles;
    self.roles = {};
    self.getSelectDocMarkers = [];
    self.docClick = docClick;
    self.refreshPreviewMap = refreshPreviewMap;
    self.closeSidenav = closeSidenav;
    self.selectDocByPid = selectDocByPid;

    function closeSidenav() {
      $mdSidenav('preview').close();
    }

    function docClick(doc){
      self.togglePreview();      
      self.selectDoc = doc;       
      self.previewMarkers = [];
      if(doc.latlon){
        var latlon = doc.latlon.split(',');
        self.previewMarkers.push({          
          lat: parseFloat(latlon[0]),
          lng: parseFloat(latlon[1]),
          focus: true,
          draggable: false
        });   
        leafletData.getMap('previewmap').then(function(map) {        
          map.invalidateSize();   
          map.setView(L.latLng(latlon[0], latlon[1]), 6);                      
        }); 
      }           
    }

    function refreshPreviewMap(){
      leafletData.getMap('previewmap').then(function(map) {        
        map.invalidateSize();                        
      });      
    }

    function getSelectDocRoles () {
      var type = ['pers', 'corp'];
      if(self.selectDoc){
        if(self.roles[self.selectDoc.pid]){
          return self.roles[self.selectDoc.pid];
        }else{
          self.roles[self.selectDoc.pid] = {};
          for(var p in self.selectDoc) {
            if(self.selectDoc.hasOwnProperty(p)){
              for (var i = 0; i < type.length; i++) {
                var bibrolesstr = 'bib_roles_' + type[i] + '_';
                if(p.startsWith(bibrolesstr)){
                  var role = p.substr(bibrolesstr.length);

                  if(!self.roles[self.selectDoc.pid][role]){
                    self.roles[self.selectDoc.pid][role] = {};
                  }
                  if(!self.roles[self.selectDoc.pid][role]['names']){
                    self.roles[self.selectDoc.pid][role]['names'] = [];
                  }
                  for (var j = 0; j < self.selectDoc[p].length; j++) {
                    self.roles[self.selectDoc.pid][role]['names'].push(self.selectDoc[p][j]);
                  }
                  
                  self.roles[self.selectDoc.pid][role]['label'] = searchService.getMarcRoleLabel(role);
                }
              }
            }
          }
        }
      }
    }

    $scope.$on('leafletDirectiveMap.moveend', function(event){
      leafletData.getMap('searchmap').then(function(map) {        
        self.searchSpatial(map);                  
      });      
    });

/* This unfortunately returns wrong model/marker from the event
    $scope.$on('leafletDirectiveMarker.searchmap.click', function(event, args, model){      
      leafletData.getMarkers('searchmap').then(function(markers) {  
        for (var i = 0; i < self.spatialDocs.length; i++) {          
          if(self.spatialDocs[i].pid == markers[args.modelName].options.pid){
            self.docClick(self.spatialDocs[i]);
          }        
        }
      });
    });
*/      

    function selectDocByPid (pid) {
      for (var i = 0; i < self.spatialDocs.length; i++) {          
        if(self.spatialDocs[i].pid == pid){
          self.docClick(self.spatialDocs[i]);
        }        
      }
    }

    self.bytesFilter = $filter('bytes');
    self.dateFilter = $filter('date');

    self.facetLabels = {
      datastreams: "Access",
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

    function refreshMap (){
      leafletData.getMap('searchmap').then(function(map) {        
        map.invalidateSize();        
        self.searchSpatial(map);                  
      });      
    }

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
          for (var i = 0; i < response.data.response.docs.length; i++) { 
            response.data.response.docs[i]['pos'] = (pageNumber * self.dynamicItems.PAGE_SIZE) + i;
            self.dynamicItems.loadedPages[pageNumber].push(response.data.response.docs[i]);
          }
          self.dynamicItems.numItems = response.data.response.numFound;
          self.facet_counts = response.data.facet_counts;
          self.facets = [];
                
          Object.keys(self.facet_counts.facet_fields).forEach(function(key,index) {
            var pos = index;
            if(key == 'datastreams'){ 
              pos = -1;
            }
            var facet = {
              field: key,
              label: self.facetLabels[key],
              counts: [],
              pos: pos
            }

            if(key == 'datastreams'){ 
              var access_filter_on = 0;     
              for (var i = 0; i < self.facet_filter.length; i++) {
                if(self.facet_filter[i].id == 'datastreams'){                  
                  access_filter_on = 1;
                  break;
                }
              }
              if(!access_filter_on){
                for (var i = 0; i < self.facet_counts.facet_fields[key].length; i=i+2) {  
                  if(self.facet_counts.facet_fields[key][i] == 'POLICY'){
                    facet.counts.push({ 
                      value: 'restricted',
                      label: self.formatFacetValue(key, 'restricted'),
                      count: self.facet_counts.facet_fields[key][i+1]
                    });
                    facet.counts.push({ 
                      value: 'unrestricted',
                      label: self.formatFacetValue(key, 'unrestricted'),
                      count: response.data.response.numFound-self.facet_counts.facet_fields[key][i+1]
                    });
                  }
                }
                self.facets.push(facet);
              }
            }else{
              for (var i = 0; i < self.facet_counts.facet_fields[key].length; i=i+2) {  
                facet.counts.push({ 
                  value: self.facet_counts.facet_fields[key][i],
                  label: self.formatFacetValue(key, self.facet_counts.facet_fields[key][i]),
                  count: self.facet_counts.facet_fields[key][i+1]
                });
              }
              self.facets.push(facet);
            }            
            
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

          for (var i = 0; i < searchService.facetQueries.length; i++) { 
            var facet = {
              label: searchService.facetQueries[i].label,
              counts: []
            }
            for (var j = 0; j < searchService.facetQueries[i].queries.length; j++) {                  
              if(self.facet_counts.facet_queries[searchService.facetQueries[i].queries[j].query]){
                facet.counts.push({ 
                  value: searchService.facetQueries[i].queries[j].query,
                  label: searchService.facetQueries[i].queries[j].label,
                  count: self.facet_counts.facet_queries[searchService.facetQueries[i].queries[j].query]
                });  
              }              
            }
            self.facets.push(facet);
          }                           

          self.facets.sort(function(a,b) {return (a.pos > b.pos) ? 1 : ((b.pos > a.pos) ? -1 : 0);} ); 
        }
        ,function(response) {
          $log.debug('Error:' + response.status);
        }
      );              
    };
    
    function search() {
      self.dynamicItems.fetchPage_(0);      
      self.refreshMap();
    }
    self.dynamicItems = new DynamicItems(); 

    function searchSpatial(map) {     

      var size = map.getSize();        
      // get map center
      var center = map.getCenter();
      // get the point at the edge of the map most distant to center
      var bounds = map.getBounds();

      /*
      var edge;
      if(size.x > size.y){          
        var lng = bounds.getEast();
        edge = L.latLng(center.lat, lng);
      }else{
        var lat = bounds.getNorth();
        edge = L.latLng(lat, center.lng);
      }
      // calculate distance of center to edge
      self.d = center.distanceTo(edge)/1000;  
      self.pt = center.lat+','+center.lng;
      */

      self.sw = bounds.getSouthWest();
      self.ne = bounds.getNorthEast();

      var promise = searchService.search(self.q, 0, self.spatialNumFoundLimit, null, self.facet_filter, self.sw, self.ne);    
      promise.then(
        function(response) {
          self.markers = []; 
          self.spatialNumFound = response.data.response.numFound;          
          self.spatialDocs = response.data.response.docs;
          for (var i = 0; i < response.data.response.docs.length; i++) {             
            var doc = response.data.response.docs[i];            
            var latlon = doc.latlon.split(',');
            self.markers.push({
              layer: 'searchresults',
              lat: parseFloat(latlon[0]),
              lng: parseFloat(latlon[1]),
              getMessageScope: function () { return $scope; },
              message: '<a ng-click="sc.selectDocByPid(\'' + doc.pid + '\')">' + doc.dc_title[0] + '</a>',
              focus: false,
              draggable: false
            });       
          }                
        }
        ,function(response) {
          $log.debug('Error:' + response.status);
        }
      );  
    }

    self.q = '';
    self.search();
    leafletData.getMap('searchmap').then(function(map) {       
      map.setView(L.latLng(48.208384, 16.373464), 6);      
    });

    self.events = {
      map: {
        enable: ['moveend', 'popupopen'],
        logic: 'emit'
      },
      marker: {
        enable: [],
        logic: 'emit'
      }
    };

    self.layers = {
      baselayers: {
         osm: {
          name: 'OpenStreetMap',
          type: 'xyz',
          url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        }
      },
      overlays: {
        searchresults: {
          name: "Search results",
          type: "markercluster",
          visible: true
        }
      }
    }
    

    function getFacetFilterLabel(ff){
      if(ff.id || ff.value){
        return self.formatFacetValue(ff.id, ff.value);      
      }else{
        if(ff.query){
          // should be facet query
          for (var i = 0; i < searchService.facetQueries.length; i++) { 
            for (var j = 0; j < searchService.facetQueries[i].queries.length; j++) {                  
              if(searchService.facetQueries[i].queries[j].query == ff.query){
                return searchService.facetQueries[i].queries[j].label;
              }
            }
          }
        }
      }
    }

    function buildToggler(navID) {
      return function() {
        // Component lookup should always be available since we are not using `ng-if`
        $mdSidenav(navID)
          .toggle()
          .then(function () {
            leafletData.getMap('previewmap').then(function(map) {        
              setTimeout(function() {
                map.invalidateSize();     
              }, 1500);                    
            }); 
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
      if(field == 'datastreams'){
        if(value == 'restricted'){
          return 'Restricted access';      
        }
        if(value == 'unrestricted'){
          return 'Unestricted access';
        }
      }
      if(field == 'ispartof'){
        return 'Collection: '+value;
      }
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

      if(field){
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

        var sign = null;
        if(field == 'datastreams'){
          if(value == 'restricted'){
            query = 'POLICY'
          }
          if(value == 'unrestricted'){
            query = 'POLICY'
            sign = '-';
          }
        }

        var found = 0;
        for (var i = 0; i < self.facet_filter.length; i++) {
          if(self.facet_filter[i].id == field){
            self.facet_filter[i].query = query;
            self.facet_filter[i].value = value;
            if(sign){
              self.facet_filter[i].sign = sign;
            }
            found = 1;
          }
        }

        if(!found){
          if(sign){
            self.facet_filter.push({ id: field, query: query, value: value, sign: sign });
          }else{
            self.facet_filter.push({ id: field, query: query, value: value });
          }
        }
      }else{
        // if there is no field this is a facet query
        self.facet_filter.push({ query: value });
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
