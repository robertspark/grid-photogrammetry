/* global Vue, mitt, turf, Blob, MapboxDraw, maplibregl */
import droneModels from './droneModels.js';

const { createApp } = Vue;
const emitter = mitt();

const download = (filename, data) => {
  const blob = new Blob([data], { type: 'text/csv' });
  if (window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveBlob(blob, filename);
  } else {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

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
      images: 0,
      area: 0,
      route: null,
      show: true,
      locationQuery: '',
    };
  },
  methods: {
    toggleShow() {
      this.show = !this.show;
    },
    setArea(area) {
      this.area = area;
    },
    setImages(images) {
      this.images = images;
    },
    setRoute(route) {
      this.route = route;
    },
    async searchLocation() {
      if (!this.locationQuery.trim()) return;

      const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(this.locationQuery)}&format=json&limit=1`;
      try {
        const response = await fetch(apiUrl);
        const [location] = await response.json();

        if (location) {
          const { lon, lat } = location;
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
      const head = 'latitude,longitude,altitude(m),heading(deg),...'; // Shortened for brevity
      if (!this.route) return;

      const data = this.route.reduce((acc, cur) => {
        return `${acc}\n${cur.map((point) => `${point.geometry.coordinates.join(',')},${this.flyHeight},...`).join('\n')}`;
      }, head);

      download('waypoints.csv', data);
    },
  },
  computed: {
    GDSW() {
      return ((this.sensorWidth / 10) / this.imageWidth) * (this.flyHeight * 100) / (this.focalLength / 10);
    },
    GDSH() {
      return ((this.sensorHeight / 10) / this.imageHeight) * (this.flyHeight * 100) / (this.focalLength / 10);
    },
    CoverturaW() {
      return (this.sensorWidth / 10) * (this.flyHeight * 100) / (this.focalLength / 10);
    },
    CoverturaH() {
      return (this.sensorHeight / 10) * (this.flyHeight * 100) / (this.focalLength / 10);
    },
    stepW() {
      return this.CoverturaW / 100000 * (1 - (this.sidelap / 100));
    },
    stepH() {
      return this.CoverturaH / 100000 * (1 - (this.overlap / 100));
    },
  },
  watch: {
    droneModel() {
      if (this.droneModel === 'custom') return;
      const model = this.droneModels[Number(this.droneModel)];
      Object.assign(this, model);
    },
  },
  template: `
    <div>
      <span 
        class="absolute block p-1 m-2 left-0 top-0 material-symbols-outlined bg-[#FFF] rounded drop-shadow-md"
        @click="toggleShow"
        :class="{ 'invisible': show }"
      >menu</span>
    </div>
    <div 
      class="absolute p-2 translate-x-[-120%] w-100 mx-auto my-24 md:m-2 rounded drop-shadow-md z-10 bg-[#FFF]"
      :class="{ 'translate-x-[0%]': show }"
    >
      <header class="relative mx-5 mb-5">
        <h2 class="text-center mb-2">Grid Photogrammetry</h2>
        <span 
          class="absolute right-0 top-0 material-symbols-outlined"
          @click="toggleShow"
        >close</span>
      </header>
      <div class="text-center mb-3">
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
      </div>
      <div class="grid grid-cols-2 gap-2 w-80 md:mx-2 mb-5 font-mono">
        <!-- Drone settings fields -->
        <label>Fly Height:</label>
        <input class="border w-full" type="number" v-model="flyHeight" />
        <!-- Add other fields similarly -->
      </div>
      <div class="text-center mb-3">
        <button 
          class="px-4 py-2 font-semibold text-sm bg-sky-500 text-white rounded shadow-sm"
          @click="downloadLitchiCSV"
        >Download Litchi CSV</button>
      </div>
    </div>
  `,
};

const control = createApp(Control).mount('#control');
