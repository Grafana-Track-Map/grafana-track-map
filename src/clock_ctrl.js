import LL from './leaflet.js'
import _ from 'lodash';
import moment from 'moment';
import './css/clock-panel.css!';
import './leaflet.css!';
import {
  MetricsPanelCtrl
} from 'app/plugins/sdk';


var myMap;
var coords = []
var highlightedMarker = null
var timeSrv


export class ClockCtrl extends MetricsPanelCtrl {
  constructor($scope, $injector) {
    super($scope, $injector);
    timeSrv = $injector.get('timeSrv')
    this.panel.maxDataPoints = 500;
    const dashboard = this.dashboard

    $scope.$root.onAppEvent('setCrosshair', function(event, info) {
      if(coords) {
        for(var i = 0; i < coords.length; i++) {
          if(coords[i].timestamp >= info.pos.x) {
            if(coords[i].circle) {
              coords[i].circle.setStyle({
                fillColor: "red",
                color: "red"
              })
            }
            if(highlightedMarker) {
              highlightedMarker.setStyle({
                fillColor: "none",
                color: "none"
              })
            }
            highlightedMarker = coords[i].circle
            break
          }
        }
      }
    })


    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('panel-teardown', this.onPanelTeardown.bind(this));
    this.events.on('panel-initialized', this.render.bind(this));
    this.events.on('data-received', function(data) {
      coords = []
      var minLat = 90
      var maxLat = -90
      var minLon = 180
      var maxLon = -180
      var polylines = []
      var polyline = []
      var lastLineHasData = false
      for(var i = 0; i < data[0].datapoints.length; i++) {
        const position = data[1].datapoints[i][0] ? Geohash.decode(data[1].datapoints[i][0]) : null
        if(position) {
          minLat = Math.min(minLat, position.lat)
          minLon = Math.min(minLon, position.lng)
          maxLat = Math.max(maxLat, position.lat)
          maxLon = Math.max(maxLon, position.lng)
          polyline.push(position)
          lastLineHasData = true
        } else {
          if(lastLineHasData) {
            polylines.push(polyline)
            polyline = []
            lastLineHasData = false
          }
        }
        coords.push({
          value: data[0].datapoints[i][0],
          hash: data[1].datapoints[i][0],
          position: position,
          timestamp: data[0].datapoints[i][1]
        })
      }
      if(lastLineHasData) {
        polylines.push(polyline)
      }

      if(myMap) {
        myMap.remove()
      }
      var center = coords.find(point => point.position)
      center = center ? center.position : [0, 0]
      myMap = L.map('themap')
      myMap.fitBounds([[minLat, minLon],
            [maxLat, maxLon]])
      var CartoDB_PositronNoLabels = L.tileLayer('http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        subdomains: 'abcd',
        maxZoom: 19
      })

      myMap.on("boxzoomend", function(e) {
        const coordsInBox = coords.filter(coord =>
          coord.position && e.boxZoomBounds.contains(L.latLng(coord.position.lat, coord.position.lng)))
        const minTime = Math.min.apply(Math, coordsInBox.map(coord => coord.timestamp))
        const maxTime = Math.max.apply(Math, coordsInBox.map(coord => coord.timestamp))
        console.log(new Date(minTime))
        console.log(new Date(maxTime))
        if (isFinite(minTime)  && isFinite(maxTime)) {
          timeSrv.setTime({
            from  : moment.utc(minTime),
            to    : moment.utc(maxTime),
          })
        }
      })

      var OpenTopoMap = L.tileLayer('http://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17
      });
      OpenTopoMap.addTo(myMap)
      var OpenSeaMap = L.tileLayer('http://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {});

      OpenSeaMap.addTo(myMap)
      polylines.forEach(polyline => {
        L.polyline(polyline, {
          color: 'blue',
          weight: 6,
          opacity: 0.9
        }).addTo(myMap)
      })
      coords.forEach(point => {
        if(point.position) {
          point.circle = L.circleMarker(point.position, {
            color: 'none',
            stroke: 'false',
            fillColor: 'none',
            fillOpacity: 0.5,
            radius: 10
          })
          point.circle.addTo(myMap)
        }
      })
    });

  }

  onInitEditMode() {
    this.addEditorTab('Options', 'public/plugins/grafana-clock-panel/editor.html', 2);
  }

  onPanelTeardown() {
    this.$timeout.cancel(this.nextTickPromise);
  }



  link(scope, elem) {
    this.events.on('render', () => {

      const $panelContainer = elem.find('.panel-container');

      if(this.panel.bgColor) {
        $panelContainer.css('background-color', this.panel.bgColor);
      } else {
        $panelContainer.css('background-color', '');
      }
    });
  }
}

ClockCtrl.templateUrl = 'module.html';


var Geohash = {};

/* (Geohash-specific) Base32 map */
Geohash.base32 = '0123456789bcdefghjkmnpqrstuvwxyz';

Geohash.decode = function(geohash) {

  var bounds = Geohash.bounds(geohash); // <-- the hard work
  // now just determine the centre of the cell...

  var latMin = bounds.sw.lat,
    lonMin = bounds.sw.lng;
  var latMax = bounds.ne.lat,
    lonMax = bounds.ne.lng;

  // cell centre
  var lat = (latMin + latMax) / 2;
  var lon = (lonMin + lonMax) / 2;

  // round to close to centre without excessive precision: ⌊2-log10(Δ°)⌋ decimal places
  lat = lat.toFixed(Math.floor(2 - Math.log(latMax - latMin) / Math.LN10));
  lon = lon.toFixed(Math.floor(2 - Math.log(lonMax - lonMin) / Math.LN10));

  return {
    lat: Number(lat),
    lng: Number(lon)
  };
};

Geohash.bounds = function(geohash) {
  if(geohash.length === 0) throw new Error('Invalid geohash');

  geohash = geohash.toLowerCase();

  var evenBit = true;
  var latMin = -90,
    latMax = 90;
  var lonMin = -180,
    lonMax = 180;

  for(var i = 0; i < geohash.length; i++) {
    var chr = geohash.charAt(i);
    var idx = Geohash.base32.indexOf(chr);
    if(idx == -1) throw new Error('Invalid geohash');

    for(var n = 4; n >= 0; n--) {
      var bitN = idx >> n & 1;
      if(evenBit) {
        // longitude
        var lonMid = (lonMin + lonMax) / 2;
        if(bitN == 1) {
          lonMin = lonMid;
        } else {
          lonMax = lonMid;
        }
      } else {
        // latitude
        var latMid = (latMin + latMax) / 2;
        if(bitN == 1) {
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }
      evenBit = !evenBit;
    }
  }

  var bounds = {
    sw: {
      lat: latMin,
      lng: lonMin
    },
    ne: {
      lat: latMax,
      lng: lonMax
    },
  };

  return bounds;
};
