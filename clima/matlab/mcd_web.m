%% mcd_web.m
% Convierte las salidas de texto de la interfaz web de la Mars Climate
% Database (MCD v6.2) en un JSON por hora y por Ls para la app MARSNOVA.
%
% Entrada : datos_crudos/MCD_web/*.txt  (descargas de la web MCD, formato
%           "Ls en filas x hora local en columnas", uno o varios bloques
%           de variables por archivo)
% Salida  : salidas/json/climatologia_web.json
%
% La web MCD da el valor a la altura pedida (aquí 2 m sobre el suelo) y
% corrige por la topografía real, con un dato por hora. Por eso sirve como
% climatología base y para validar mcd_condiciones.m.
%
% Notas:
% - La última fila (Ls 360) repite Ls 0 y la última columna (24 h) repite
%   0 h: se descartan.
% - Las temperaturas (aire y superficie) se pasan de K a °C. Todo se redondea a 4 cifras significativas.
% - Los títulos se normalizan (espacios repetidos) antes de buscarlos en 'mapa'.

clear; clc;

% Carpeta 'clima' (la que contiene matlab/, datos_crudos/ y salidas/)
raiz = fileparts(fileparts(mfilename('fullpath')));
if isempty(raiz), raiz = '/Users/laurarengifo/Desktop/SpaceApps2026/clima'; end
carpetaWeb = fullfile(raiz, 'datos_crudos', 'MCD_web');
salidaJSON = fullfile(raiz, 'salidas', 'json');
if ~exist(salidaJSON, 'dir'), mkdir(salidaJSON); end

% Nombre en el JSON, nombre legible y unidad, según el título de la MCD
mapa = { ...
  'Surface temperature (K)',                    'tsurf_c',          'Temperatura de la superficie', '°C'; ...
  'Temperature (K)',                            'taire_c',          'Temperatura del aire (2 m)', '°C'; ...
  'Surface pressure (Pa)',                      'ps_pa',            'Presión en superficie',      'Pa'; ...
  'Horizontal wind speed (m/s)',                'viento_ms',        'Viento horizontal',          'm/s'; ...
  'Monthly mean surface CO2 ice layer (kg/m2)', 'co2ice_kgm2',      'Hielo de CO2 en superficie', 'kg/m²'; ...
  'Water ice column (kg/m2)',                   'nubes_hielo_kgm2', 'Hielo de agua en nubes (columna)', 'kg/m²'; ...
  'Density (kg/m3)',                            'densidad_kgm3',    'Densidad del aire',          'kg/m³'; ...
  'Incident solar flux at top of the atmosphere (W/m2)', 'sol_toa_wm2', 'Luz solar en el tope de la atmósfera', 'W/m²'; ...
  'Incident solar flux on horizontal surface (W/m2)',    'sol_superficie_wm2', 'Luz solar en la superficie (horizontal)', 'W/m²'; ...
  'thermal IR flux to space (W/m2)',            'ir_espacio_wm2',   'Infrarrojo térmico hacia el espacio', 'W/m²'; ...
  'thermal IR flux on surface (W/m2)',          'ir_superficie_wm2', 'Infrarrojo térmico sobre la superficie', 'W/m²'; ...
  'Sun-Mars distance (in Astronomical Unit AU)', 'distancia_sol_ua', 'Distancia Sol–Marte', 'UA'; ...
  'Solar zenith angle (deg)',                   'angulo_cenital_deg', 'Ángulo cenital del Sol', '°'; ...
  'Daily mean dust column visible optical depth above surface', 'tau_polvo', 'Opacidad del polvo (visible, media diaria)', ''; ...
  'O3 column (kg/m2)',                          'ozono_kgm2',       'Columna de ozono',           'kg/m²'};

archivos = dir(fullfile(carpetaWeb, '*.txt'));
if isempty(archivos), error('No hay archivos .txt en %s', carpetaWeb); end

variables = struct();
meta = struct('escenario', '', 'punto', '', 'recuperado', '');
horas = []; ls = [];

for a = 1:numel(archivos)
    lineas = splitlines(fileread(fullfile(carpetaWeb, archivos(a).name)));
    titulo = ''; filasLs = []; datos = [];
    for i = 1:numel(lineas) + 1
        if i <= numel(lineas), L = strtrim(lineas{i}); else, L = '### FIN'; end

        % Cierra el bloque anterior cuando empieza otro (o termina el archivo)
        if startsWith(L, '###') && ~isempty(titulo) && ~isempty(datos)
            [variables, ls] = guardarBloque(variables, mapa, titulo, filasLs, datos, ls);
            titulo = ''; filasLs = []; datos = [];
        end

        tok = regexp(L, '^### Columns 2\+ are (.+)$', 'tokens', 'once');
        if ~isempty(tok), titulo = regexprep(strtrim(tok{1}), '\s+', ' '); continue, end

        if startsWith(L, '### MCD_v') && isempty(meta.escenario)
            meta.escenario = strtrim(erase(L, '###'));
        elseif startsWith(L, '### Latitude') && isempty(meta.punto)
            meta.punto = strtrim(erase(L, '###'));
        elseif startsWith(L, '### Retrieved on:') && isempty(meta.recuperado)
            meta.recuperado = strtrim(erase(L, '### Retrieved on:'));
        end

        if startsWith(L, '---- ||')                       % fila de horas
            h = sscanf(strtrim(extractAfter(L, '||')), '%f')';
            horas = h(h < 24);
            continue
        end

        tok = regexp(L, '^([+-]\d+)\s*\|\|(.*)$', 'tokens', 'once');
        if ~isempty(tok) && ~isempty(titulo)
            fila = sscanf(strtrim(tok{2}), '%f')';
            filasLs(end+1) = str2double(tok{1});           %#ok<SAGROW>
            datos(end+1, :) = fila;                        %#ok<SAGROW>
        end
    end
    fprintf('%s leído\n', archivos(a).name);
end

salida = struct();
salida.sitio      = 'Monte Sharp, cráter Gale (centro de la zona del DTM HiRISE)';
salida.fuente     = 'Mars Climate Database v6.2, interfaz web';
salida.escenario  = meta.escenario;
salida.punto      = meta.punto;
salida.recuperado = meta.recuperado;
salida.horas      = horas;
salida.ls         = ls;
salida.nota       = 'valores[i][j] = Ls ls(i), hora local horas(j). Ls 360 y 24 h se omiten porque repiten Ls 0 y 0 h.';
salida.variables  = variables;

archivo = fullfile(salidaJSON, 'climatologia_web.json');
fid = fopen(archivo, 'w');
fprintf(fid, '%s', jsonencode(salida, 'PrettyPrint', true));
fclose(fid);
fprintf('Listo: %s (%d variables, %d valores de Ls, %d horas)\n', ...
        archivo, numel(fieldnames(variables)), numel(ls), numel(horas));

%% ---------- Funciones locales ----------
function [variables, ls] = guardarBloque(variables, mapa, titulo, filasLs, datos, ls)
    if startsWith(titulo, 'Ls,'), return, end   % bloque de Ls de cd2.0: no es una variable
    k = find(strcmp(mapa(:, 1), titulo), 1);
    if isempty(k)
        clave = matlab.lang.makeValidName(titulo); nombre = titulo; unidad = '';
    else
        clave = mapa{k, 2}; nombre = mapa{k, 3}; unidad = mapa{k, 4};
    end
    usar = filasLs < 360;                 % Ls 360 repite Ls 0
    valores = datos(usar, 1:end-1);       % la columna de 24 h repite 0 h
    if endsWith(titulo, '(K)'), valores = valores - 273.15; end
    valores = round(valores, 4, 'significant');   % 4 cifras significativas
    variables.(clave) = struct('nombre', nombre, 'unidad', unidad, 'valores', valores);
    if isempty(ls), ls = filasLs(usar); end
end
