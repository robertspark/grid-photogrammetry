/* global Vue, mitt, turf, Blob, MapboxDraw, maplibregl */
import droneModels from './droneModels.js'

const { createApp } = Vue
const emitter = mitt()
const DEBUG = false

Math.grados = radianes => {
  return radianes * 180 / Math.PI
}
Math.radianes = grados => {
  return Math.PI * grados / 180
}

const download = (filename, data) => {
  console.log('download')
  const blob = new Blob([data], { type: 'text/csv' })
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
@@ -64,8 +61,9 @@

const { map, draw } = initMap();

const Control = {
  data () {
    return {
      droneModels,
      droneModel: 'custom',
@@ -84,23 +82,23 @@
      area: 0,
      route: null,
      show: true,
	  locationQuery: '',
    };
  },
  methods: {
    toogleShow () {
      this.show = !this.show
    },
    setArea (area) {
      this.area = area
    },
    setImages (images) {
      this.images = images
    },
    setRoute (route) {
      this.route = route
    },
	    async searchLocation() {
      if (!this.locationQuery.trim()) return;

      const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(this.locationQuery)}&format=json&limit=1`;
@@ -119,86 +117,70 @@
        console.error('Error searching location:', error);
      }
    },
    downloadLitchiCSV () {
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
    GDSW () {
      return ((this.sensorWidth / 10) / this.imageWidth) * (this.flyHeight * 100) / (this.focalLength / 10)
    },
    GDSH () {
      return ((this.sensorHeight / 10) / this.imageHeight) * (this.flyHeight * 100) / (this.focalLength / 10)
    },
    CoverturaW () {
      return (this.sensorWidth / 10) * (this.flyHeight * 100) / (this.focalLength / 10)
    },
    CoverturaH () {
      return (this.sensorHeight / 10) * (this.flyHeight * 100) / (this.focalLength / 10)
    },
    stepW () {
      return this.CoverturaW / 100000 * (1 - (this.sidelap / 100))
    },
    stepH () {
      return this.CoverturaH / 100000 * (1 - (this.overlap / 100))
    }
  },
  watch: {
    droneModel () {
      if (this.droneModel === 'custom') return
      const { focalLength, imageHeight, imageWidth, sensorHeight, sensorWidth } = this.droneModels[Number(this.droneModel)]
      this.focalLength = focalLength
      this.imageHeight = imageHeight
      this.imageWidth = imageWidth
      this.sensorHeight = sensorHeight
      this.sensorWidth = sensorWidth
    },
    focalLength () {
      emitter.emit('control.update')
    },
    imageWidth () {
      emitter.emit('control.update')
    },
    imageHeight () {
      emitter.emit('control.update')
    },
    sensorWidth () {
      emitter.emit('control.update')
    },
    sensorHeight () {
      emitter.emit('control.update')
    },
    flyHeight () {
      emitter.emit('control.update')
    },
    overlap () {
      emitter.emit('control.update')
    },
    sidelap () {
      emitter.emit('control.update')
    },
    angle () {
      emitter.emit('control.update')
    },
    showFrames () {
      emitter.emit('control.update')
    },
    showCameras () {
      emitter.emit('control.update')
    }
  },
  template: `
  <div>
    <span   
      class="absolute block p-1 m-2 left-0 top-0 material-symbols-outlined bg-[#FFF] rounded drop-shadow-md"
@@ -353,10 +335,16 @@
      >
        Download Litchi CSV
      </button>
    </div>
  </div>
  `
}

const control = createApp(Control).mount('#control')
