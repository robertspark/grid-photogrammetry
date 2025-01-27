/* global Vue, mitt, turf, Blob, MapboxDraw, maplibregl */
import droneModels from './droneModels.js'

const {
    createApp
} = Vue
const emitter = mitt()
const DEBUG = false

Math.degrees = radians => {
    return radians * 180 / Math.PI
}

Math.radians = degrees => {
    return Math.PI * degrees / 180
}

const download = (filename, data) => {
    console.log('download')
    const blob = new Blob([data], {
        type: 'text/csv'
    })
    if (window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, filename)
    } else {
        const elem = window.document.createElement('a')
        elem.href = window.URL.createObjectURL(blob)
        elem.download = filename
        document.body.appendChild(elem)
        elem.click()
        document.body.removeChild(elem)
    }
}

const initMap = () => {
    const draw = new MapboxDraw({
        controls: {
            combine_features: false,
            line_string: false,
            uncombine_features: false,
            point: false,
        },
        defaultMode: 'draw_polygon',
    });

    const map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                osm: {
                    type: 'raster',
                    tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '&copy; OpenStreetMap Contributors',
                    maxzoom: 19,
                },
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [0, 0], // [lng, lat]
        zoom: 2,
    });

    map.addControl(draw, 'top-right');
    return { map, draw };
};

const { map, draw } = initMap();

const Control = {
    data() {
        return {
            droneModels,
            droneModel: 'custom',
            focalLength: 8.4,
            imageWidth: 5472,
            imageHeight: 3648,
            sensorWidth: 13.31,
            sensorHeight: 8.88,
            flyHeight: 50,
            overlap: 80,
            sidelap: 80,
            angle: 270,
            showFrames: false,
            showCameras: true,
	    showOrtho: false,
            images: 0,
	    H: 0,
            area: 0,
            route: null,
            show: true,
            locationQuery: '',
        };
    },
    methods: {
        toggleMapStyle() {
            const satelliteStyle = {
                version: 8,
                sources: {
                    satellite: {
                        type: 'raster',
                        tiles: [
                            'https://api.maptiler.com/tiles/satellite/{z}/{x}/{y}.png?key=LvDyGh6pB4DLFocCL5Kp',
                        ],
                        tileSize: 256,
                        attribution: '&copy; MapTiler &copy; OpenStreetMap Contributors',
                        maxzoom: 19,
                    },
                },
                layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
            };

            const mapStyle = {
                version: 8,
                sources: {
                    osm: {
                        type: 'raster',
                        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '&copy; OpenStreetMap Contributors',
                        maxzoom: 19,
                    },
                },
                layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
            };

            if (map.getStyle().layers[0].id === 'osm') {
                map.setStyle(satelliteStyle);
            } else {
                map.setStyle(mapStyle);
            }
        },
        toogleShow() {
            this.show = !this.show
        },
        setArea(area) {
            this.area = area
        },
        setImages(images) {
            this.images = images
        },
        setRoute(route) {
            this.route = route
        },
        async searchLocation() {
            if (!this.locationQuery.trim()) return;

            const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(this.locationQuery)}&format=json&limit=1`;
            try {
                const response = await fetch(apiUrl);
                const [location] = await response.json();

                if (location) {
                    const {
                        lon,
                        lat
                    } = location;
                    map.setCenter([parseFloat(lon), parseFloat(lat)]);
                    map.setZoom(15);
                } else {
                    alert('Location not found. Please refine your search.');
                }
            } catch (error) {
                console.error('Error searching location:', error);
            }
        },
        downloadLitchiCSV() {
            console.log('downloadLitchiCSV', this.route)
            const head = 'latitude,longitude,altitude(m),heading(deg),curvesize(m),rotationdir,gimbalmode,gimbalpitchangle,actiontype1,actionparam1,actiontype2,actionparam2,actiontype3,actionparam3,actiontype4,actionparam4,actiontype5,actionparam5,actiontype6,actionparam6,actiontype7,actionparam7,actiontype8,actionparam8,actiontype9,actionparam9,actiontype10,actionparam10,actiontype11,actionparam11,actiontype12,actionparam12,actiontype13,actionparam13,actiontype14,actionparam14,actiontype15,actionparam15,altitudemode,speed(m/s),poi_latitude,poi_longitude,poi_altitude(m),poi_altitudemode,photo_timeinterval,photo_distinterval'

            if (this.route === null) return

            const data = this.route.reduce((aco, cur) => {
                return `${aco}\n` +
                    `${cur[0].geometry.coordinates[1].toFixed(8)},${cur[0].geometry.coordinates[0].toFixed(8)},${this.flyHeight},0,0,0,0,-90,5,-90,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,0,0,0,0,0,0,-1,${this.stepH * 1000}\n` +
                    `${cur[1].geometry.coordinates[1].toFixed(8)},${cur[1].geometry.coordinates[0].toFixed(8)},${this.flyHeight},0,0,0,0,-90,5,-90,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,0,0,0,0,0,0,-1,-1`
            }, head)

            download('waypoints.csv', data)
        }
    },
    computed: {
        GDSW() {
            return ((this.sensorWidth / 10) / this.imageWidth) * (this.flyHeight * 100) / (this.focalLength / 10)
        },
        GDSH() {
            return ((this.sensorHeight / 10) / this.imageHeight) * (this.flyHeight * 100) / (this.focalLength / 10)
        },
        CoverageW() {
            return (this.sensorWidth / 10) * (this.flyHeight * 100) / (this.focalLength / 10)
        },
        CoverageH() {
            return (this.sensorHeight / 10) * (this.flyHeight * 100) / (this.focalLength / 10)
        },
        stepW() {
            return this.CoverageW / 100000 * (1 - (this.sidelap / 100))
        },
        stepH() {
            return this.CoverageH / 100000 * (1 - (this.overlap / 100))
        }
    },
    watch: {
        droneModel() {
            if (this.droneModel === 'custom') return
            const {
                focalLength,
                imageHeight,
                imageWidth,
                sensorHeight,
                sensorWidth
            } = this.droneModels[Number(this.droneModel)]
            this.focalLength = focalLength
            this.imageHeight = imageHeight
            this.imageWidth = imageWidth
            this.sensorHeight = sensorHeight
            this.sensorWidth = sensorWidth
        },
        focalLength() {
            emitter.emit('control.update')
        },
        imageWidth() {
            emitter.emit('control.update')
        },
        imageHeight() {
            emitter.emit('control.update')
        },
        sensorWidth() {
            emitter.emit('control.update')
        },
        sensorHeight() {
            emitter.emit('control.update')
        },
        flyHeight() {
            emitter.emit('control.update')
        },
        overlap() {
            emitter.emit('control.update')
        },
        sidelap() {
            emitter.emit('control.update')
        },
        angle() {
            emitter.emit('control.update')
        },
        showFrames() {
            emitter.emit('control.update')
        },
        showCameras() {
            emitter.emit('control.update')
        }
    },
    template: `
  <div>
    <span   
      class="absolute block p-1 m-2 left-0 top-0 material-symbols-outlined bg-[#FFF] rounded drop-shadow-md"
      v-on:click="toogleShow"
      v-bind:class="{ 'invisible' : show}"
    > menu </span>
  </div>
  <div 
    class="absolute p-2  translate-x-[-120%] w-100 mx-auto my-24 md:m-2 rounded drop-shadow-md z-10 bg-[#FFF]"
    v-bind:class="{ 'translate-x-[0%]' : show}"
    >
    <header class="relative mx-5 mb-5">
      <h2 class="text-center mb-2">Grid Photogrammetry</h2>
      <span   
        class="absolute right-0 top-0 material-symbols-outlined"
        v-on:click="toogleShow"
      > close </span> 
    </header>
	
    <div class="text-center mb-3 font-mono">
        <label for="location">Location:</label>
        <input
          id="location"
          type="text"
          class="border text-center w-48"
          v-model="locationQuery"
          placeholder="Enter a location"
        />
        <button
          class="px-4 py-2 font-semibold text-sm bg-sky-500 text-white rounded shadow-sm ml-2"
          @click="searchLocation"
          >Search</button> 
        <button
          class="px-4 py-2 font-semibold text-sm bg-sky-500 text-white rounded shadow-sm ml-2"
          @click="toggleMapStyle"
          >Toggle Map/Satellite View</button>
   </div>

   <div class="grid grid-cols-2 w-80  md:mx-2 mb-5 font-mono">
      <label>Drone Model : </label>
      <span class="align-middle">
        <select class="border block-inline text-left w-40" type="number" v-model="droneModel">
          <option value="custom">Custom</option>
          ${droneModels.map((e, i) => '<option value="' + i + '">' + e.name + '</option> ').join('')}
        </select>
      </span>
      <label>Focal Length : </label>
      <span class="align-middle">
        <input 
          class="border block-inline text-right w-24" type="number"
          v-model="focalLength"
          max="100" min="0"
          step="0.01"
          :disabled="droneModel  !== 'custom'"
        /> [mm]
      </span>
      
      <label>Image Width : </label>
      <span class="align-middle">
        <input 
          class="border block-inline text-right w-24" 
          type="number" 
          v-model="imageWidth" 
          max="100000" 
          min="0"  
          step="1"
          :disabled="droneModel  !== 'custom'"
        /> [px]
      </span>
      <label>Image Height : </label>
      <span class="align-middle">
        <input 
          class="border block-inline text-right w-24" 
          type="number" 
          v-model="imageHeight" 
          max="100000" 
          min="0"  
          step="1"
          :disabled="droneModel  !== 'custom'"
        /> [px]
      </span>
      <label>Sensor Width : </label>
      <span class="align-middle">
        <input 
          class="border block-inline text-right w-24" 
          type="number" 
          v-model="sensorWidth" 
          max="100" 
          min="0"  
          step="0.01"
          :disabled="droneModel  !== 'custom'"
        /> [mm]
      </span>
      <label>Sensor Height : </label>
      <span class="align-middle">
        <input 
          class="border block-inline text-right w-24" 
          type="number" 
          v-model="sensorHeight" 
          max="100" 
          min="0"  
          step="0.01"
          :disabled="droneModel  !== 'custom'"
        /> [mm]
      </span>
      <label>Fly Height : </label>
      <span class="align-middle">
        <input class="border block-inline text-right w-24" type="number" v-model="flyHeight" max="1000" min="0"  step="10"/> [m]
      </span>
      <label>Angle : </label>
      <span class="align-middle">
        <input class="border block-inline text-right w-24" type="number" v-model="angle" max="360" min="0"  step="1"/> [º]
      </span>
      <label>Overlap : </label>
      <span class="align-middle">
        <input class="border block-inline text-right w-24" type="number" v-model="overlap" max="99" min="0"  step="1"/> [%]
      </span>
      <label>Sidelap : </label>
      <span class="align-middle">
        <input class="border block-inline text-right w-24" type="number" v-model="sidelap" max="99" min="0"  step="1"/> [%]
      </span>
      <label>Show Frames : </label>
      <span class="align-middle">
        <input type="checkbox" v-model="showFrames" />
      </span>
      <label>Show Cameras : </label>
      <span class="align-middle">
        <input type="checkbox" v-model="showCameras" />
      </span>
      <label>Ortho+Nadir Export : </label>
      <span class="align-middle">
        <input type="checkbox" v-model="showOrtho" />
      </span>
    </div>
    
    <div class="font-mono mb-3 mx-2">
      <div>GDS<sub>w</sub> = {{Math.round(GDSW * 100) / 100}} cm </div> 
      <div>GDS<sub>h</sub> = {{Math.round(GDSH * 100) / 100}} cm </div> 
      <div>Coverage<sub>w</sub> = {{Math.round(CoverageW) / 100}} m </div> 
      <div>Coverage<sub>h</sub> = {{Math.round(CoverageH) / 100}} m </div> 
      <div>Area = {{area}} m² </div>
      <div>Step = {{Math.round(stepH * 10000) / 10}} m </div> 
      <div>Images = {{images}}</div> 
    </div>
    <div class="text-center mb-3">
      <button 
        class="px-4 py-2 font-semibold text-sm bg-sky-500 text-white rounded-none shadow-sm"
        v-on:click="downloadLitchiCSV"
      >
        Download Litchi CSV
      </button>
    </div>
  </div>
  `
}

const control = createApp(Control).mount('#control')

const updateRoute = (draw, polygon, control) => {
    if (!polygon) {
        draw.changeMode('draw_polygon')
        return
    }

    control.setArea(turf.area(polygon))
    const {
        CoverageW,
        CoverageH,
        angle,
        showCameras,
        showFrames,
        stepW,
        stepH
    } = control

    const route = genRoute(angle, stepW, polygon)
    control.setRoute(route)

    const points = route
        .reduce((points, s) => {
            const distance = turf.distance(s[0], s[1])
            const angle = turf.bearing(s[0], s[1])

            return [
                ...points,
                ...Array(Math.ceil(distance / stepH))
                    .fill(null)
                    .map((_, i) => turf.rhumbDestination(s[0], stepH * i, angle))
            ]
        }, [])

    control.setImages(points.length)

    points
        .forEach(p => {
            showFrames && draw.add(frame(CoverageW, CoverageH, angle, p))
            showCameras && draw.add(p)
        })

    draw.add({
        id: 'gf-route',
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: route
                .map(s => [s[0].geometry.coordinates, s[1].geometry.coordinates])
                .reduce((aco, cur) => [...aco, cur[0], cur[1]])
        }
    })
}

const genRoute = (angle, step, polygon) => {
    // Boundary box
    const bbox = turf.bbox(polygon)
    const pointA = turf.point([bbox[0], bbox[1]])
    const pointB = turf.point([bbox[2], bbox[3]])
    const pointC = turf.point([bbox[0], bbox[3]])
    // const pointD = turf.point([bbox[2], bbox[1]])

    const alfa = turf.bearing(pointA, pointB)
    const beta = Math.abs(90 - alfa)
    const hypot = turf.distance(pointA, pointB)

    if (DEBUG) {
        console.log('angle', angle)
        console.log('α', alfa)
        console.log('β', beta)
        console.log('h', hypot)
        console.log('C------B')
        console.log('|++++/+|')
        console.log('|+++/++|')
        console.log('|α /β++|')
        console.log('A______D')

        draw.add({
            id: 'gf-debug-1',
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [
                    [bbox[0], bbox[1]],
                    [bbox[0], bbox[3]]
                ]
            }
        })

        draw.add({
            id: 'gf-debug-2',
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [
                    [bbox[0], bbox[3]],
                    [bbox[2], bbox[3]]
                ]
            }
        })

        draw.add({
            id: 'gf-debug-3',
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [
                    [bbox[0], bbox[3]],
                    [bbox[2], bbox[1]]
                ]
            }
        })

        draw.add({
            id: 'gf-debug-4',
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [
                    [bbox[2], bbox[3]],
                    [bbox[0], bbox[1]]
                ]
            }
        })
    }

    const angleIdentity = angle % 180
    const stepCorrection = angleIdentity > 90 ?
        Math.abs(step / Math.cos(Math.radians((angleIdentity - 90) - alfa))) :
        Math.abs(step / Math.cos(Math.radians(angleIdentity - beta)))

    const segments = Math.floor(hypot / stepCorrection)
    const origin = angleIdentity > 90 ? pointB : pointC
    const angleH = angleIdentity > 90 ? 180 + alfa : 90 + beta

    if (DEBUG) {
        console.log(step, stepCorrection)
    }

    const route = Array(segments + 1).fill(null)
        .map((_, i) => {
            const p0 = turf.rhumbDestination(origin, stepCorrection * i, angleH)
            const p1 = turf.rhumbDestination(p0, hypot, angleIdentity).geometry.coordinates
            const p2 = turf.rhumbDestination(p0, hypot, angleIdentity + 180).geometry.coordinates
            return {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: [p1, p2]
                }
            }
        })
        .map(line => turf.lineIntersect(line, polygon).features
            .sort((a, b) => b.geometry.coordinates.reduce((aco, cur) => aco + cur, 0) - a.geometry.coordinates.reduce((aco, cur) => aco + cur, 0))
        )
        .filter(intersects => intersects.length > 0 && intersects.length % 2 === 0)
        .reduce((route, intersects) => {
            return [
                ...route,
                ...Array(intersects.length / 2)
                    .fill([])
                    .map((_, i) => intersects.slice(2 * i, 2 * (i + 1)))
                    .map(s => [
                        s[0],
                        s[1]
                    ])
            ]
        }, [])

    sortRoute(route)
        .map(([p1, p2]) => ({
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [p1.geometry.coordinates, p2.geometry.coordinates]
            }
        }))

    if (DEBUG) {
        console.log(route)
    }

    return sortRoute(route)
}

const frame = (CoverageW, CoverageH, angle, origin) => {
    const hypot = Math.hypot(CoverageH, CoverageW) / 200000
    const offsetAngle = (angle - 90) % 360
    const teta = Math.degrees(Math.atan2(CoverageH, CoverageW))

    const x1 = turf.rhumbDestination(origin, hypot, teta + offsetAngle).geometry.coordinates
    const x2 = turf.rhumbDestination(origin, hypot, 180 - teta + offsetAngle).geometry.coordinates
    const x3 = turf.rhumbDestination(origin, hypot, 180 + teta + offsetAngle).geometry.coordinates
    const x4 = turf.rhumbDestination(origin, hypot, 360 - teta + offsetAngle).geometry.coordinates

    return {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: [
                [
                    [x1[0], x1[1]],
                    [x2[0], x2[1]],
                    [x3[0], x3[1]],
                    [x4[0], x4[1]],
                    [x1[0], x1[1]]
                ]
            ]
        }
    }
}

// Not is the best route only findNearest
const findNearest = (point, lines) => {
    const {
        nearest,
        others
    } = lines
        .map(l => ({
            p: l,
            d: l.map(p => turf.distance(point, p))
        }))
        .reduce((result, current) => {
            if (result.nearest === null) {
                return {
                    ...result,
                    nearest: current
                }
            }

            if (Math.min(...result.nearest.d) < Math.min(...current.d)) {
                return {
                    ...result,
                    others: [...result.others, current]
                }
            }

            return {
                nearest: current,
                others: [result.nearest, ...result.others]
            }
        }, {
            nearest: null,
            others: []
        })

    return [
        nearest.d[0] < nearest.d[1] ? nearest.p : [nearest.p[1], nearest.p[0]],
        ...others.map(o => o.p)
    ]
}

const sortRoute = lines => lines.length === 1 ?
    lines : [lines[0], ...sortRoute(findNearest(lines[0][1], lines.slice(1)))]

map.on('draw.create', e => {
    const polygon = {
        ...e.features[0],
        id: 'polygon'
    }
    draw.getAll().features.map(f => draw.delete(f.id))
    draw.add(polygon)
    updateRoute(draw, polygon, control)
})

map.on('draw.update', () => {
    draw.getAll().features.map(f => f.id !== 'polygon' && draw.delete(f.id))
    updateRoute(draw, draw.get('polygon'), control)
})

emitter.on('control.update', () => {
    draw.getAll().features.map(f => f.id !== 'polygon' && draw.delete(f.id))
    updateRoute(draw, draw.get('polygon'), control)
})
