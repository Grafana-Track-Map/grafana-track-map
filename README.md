# grafana-track-map
(Gps) track map visualisation plugin

Grafana map plugin that allows you to draw tracks on Leaflet-based map on Geohash data from your Grafana backend database.

Selected time is shown on the map as you move mouse over other graphs. You can shift-drag select on the map to zoom in in time.

![image](https://cloud.githubusercontent.com/assets/1049678/22856671/bb093ad4-f09e-11e6-9e61-f1f6125a38b9.png)

The coordinates must be stored as [Geohash](https://en.wikipedia.org/wiki/Geohash) strings in the database. I have used the plugin with InfluxDb with a query like

```
SELECT mean("navigationSpeedOverGround") as "value",first("navigationPosition")  as geohash 
FROM "signalk" WHERE $timeFilter GROUP BY time($interval) fill(null)
```

You have to manually install this under Grafanan plugins directory (/var/lib/grafana/plugins/) and build it with 
```
npm install
npm install -g grunt
grunt
```

The first command installs the needed dependencies, second installs `grunt` build tool and third runs the build.
