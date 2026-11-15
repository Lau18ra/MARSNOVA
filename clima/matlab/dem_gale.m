%% dem_gale.m
% Mapa de contexto MOLA (MEGDR, 128 px/grado, ~463 m/px) de la región de Gale
% con la zona de trabajo marcada, y elevaciones de referencia para corregir
% la presión de la Mars Climate Database (MCD).
%
% Entrada : datos_crudos/MOLA/megt00n090hb.img  (cubre 0°..44° S, 90°..180° E)
% Salidas : salidas/figuras/mola_gale_zona.png
%           salidas/json/elevacion_zona.json
%
% Ejecutar ANTES de mcd_condiciones.m si se quiere la presión corregida.

clear; clc;

%% Configuración
% Carpeta 'clima' (la que contiene matlab/, datos_crudos/ y salidas/)
raiz = fileparts(fileparts(mfilename('fullpath')));
if isempty(raiz), raiz = '/Users/laurarengifo/Desktop/SpaceApps2026/clima'; end
archivoDEM = fullfile(raiz, 'datos_crudos', 'MOLA', 'megt00n090hb.img');
salidaFig  = fullfile(raiz, 'salidas', 'figuras');
salidaJSON = fullfile(raiz, 'salidas', 'json');

% Zona de trabajo (DTM HiRISE), planetocéntrica, longitud este 0–360
latMin = -4.948844;  latMax = -4.720558;
lonMin = 137.238958; lonMax = 137.353924;
latC = (latMin + latMax)/2;   lonC = (lonMin + lonMax)/2;

% Ventana regional para la figura (cráter Gale completo)
ventLat = [-7.5 -3.0];
ventLon = [135.5 140.0];

% Tamaño de una celda de la MCD (malla 64 x 49)
celdaLat = 3.75;  celdaLon = 5.625;
H = 11000;        % altura de escala aproximada de la atmósfera marciana (m)

if ~exist(salidaFig,  'dir'), mkdir(salidaFig);  end
if ~exist(salidaJSON, 'dir'), mkdir(salidaJSON); end

%% Leer el mosaico MOLA (enteros de 16 bits, big-endian)
filas = 44*128;   % 5632
cols  = 90*128;   % 11520
[fid, msg] = fopen(archivoDEM, 'r', 'ieee-be');
if fid < 0, error('No se pudo abrir %s: %s', archivoDEM, msg); end
Z = fread(fid, [cols filas], 'int16=>double')';
fclose(fid);

% Coordenadas del centro de cada píxel
lat = -((0:filas-1) + 0.5) / 128;        % de 0° hacia el sur
lon =  90 + ((0:cols-1) + 0.5) / 128;    % de 90° E hacia el este

%% Elevaciones de referencia
enZona  = lat >= latMin & lat <= latMax;
enZonaC = lon >= lonMin & lon <= lonMax;
Zzona   = Z(enZona, enZonaC);

enCelda  = abs(lat - latC) <= celdaLat/2;
enCeldaC = abs(lon - lonC) <= celdaLon/2;
Zcelda   = Z(enCelda, enCeldaC);

zZona  = mean(Zzona(:));
zCelda = mean(Zcelda(:));
factorPresion = exp(-(zZona - zCelda) / H);

fprintf('Píxeles MOLA en la zona: %d x %d\n', size(Zzona, 1), size(Zzona, 2));
fprintf('Elevación zona   : media %.0f m (mín %.0f, máx %.0f)\n', ...
        zZona, min(Zzona(:)), max(Zzona(:)));
fprintf('Elevación celda MCD (%.2f° x %.3f°): media %.0f m\n', celdaLat, celdaLon, zCelda);
fprintf('Factor de corrección de presión: %.3f\n', factorPresion);

%% Figura de contexto
fv  = lat >= ventLat(1) & lat <= ventLat(2);
fvc = lon >= ventLon(1) & lon <= ventLon(2);

fig = figure('Position', [100 100 900 700]);
imagesc(lon(fvc), lat(fv), Z(fv, fvc) / 1000);
axis xy image; colormap(turbo);
cb = colorbar; cb.Label.String = 'Elevación respecto al areoide (km)';
hold on
rectangle('Position', [lonMin latMin lonMax-lonMin latMax-latMin], ...
          'EdgeColor', 'w', 'LineWidth', 2);
plot(lonC, latC, 'w+', 'MarkerSize', 10, 'LineWidth', 1.5);
text(lonMax + 0.08, latMax, 'Zona de trabajo (DTM HiRISE)', ...
     'Color', 'w', 'FontWeight', 'bold', 'VerticalAlignment', 'top');
xlabel('Longitud (°E)'); ylabel('Latitud (°N)');
title({'Cráter Gale – MOLA MEGDR 128 px/°', ...
       sprintf('Zona: %.0f m de elevación media', zZona)});
exportgraphics(fig, fullfile(salidaFig, 'mola_gale_zona.png'), 'Resolution', 200);

%% Guardar elevaciones para mcd_condiciones.m
salida = struct( ...
    'fuente', 'MOLA MEGDR 128 px/grado (megt00n090hb)', ...
    'zona', struct('lat', [latMin latMax], 'lon_este', [lonMin lonMax], ...
                   'centro', [latC lonC]), ...
    'elevacion_zona_m', struct('media', round(zZona), ...
                               'min', min(Zzona(:)), 'max', max(Zzona(:))), ...
    'elevacion_celda_mcd_m', round(zCelda), ...
    'altura_escala_m', H, ...
    'factor_presion', round(factorPresion, 4), ...
    'nota', 'ps_zona = ps_celda * factor_presion; aproximación hidrostática');
fid = fopen(fullfile(salidaJSON, 'elevacion_zona.json'), 'w');
fprintf(fid, '%s', jsonencode(salida, 'PrettyPrint', true));
fclose(fid);
fprintf('Listo: figura y elevacion_zona.json guardados.\n');
