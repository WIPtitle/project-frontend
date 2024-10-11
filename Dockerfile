# Usa un'immagine ufficiale di Node.js come base
FROM node:18.17.0

# Imposta la directory di lavoro all'interno del container
WORKDIR /app

# Copia i file package.json e package-lock.json nella directory di lavoro
COPY package*.json ./

# Installa le dipendenze
RUN npm install

# Copia il resto dei file del progetto nella directory di lavoro
COPY . .

# Compila l'app Next.js
RUN npm run build

# Espone la porta che Next.js utilizza (3000 per default)
EXPOSE 3000

# Avvia l'app Next.js
CMD ["npm", "start"]
