# Biblioteca
Como parte de la Actividad 4 API_REST del laboratorio de Programación Web, se realizó una aplicación web que por medio de la API de Open Library, se recopila y almacena localmente información de libros disponible en la base de datos de la API.

[EXPLICACIÓN DE LA API]

Para esta actividad de laboratorio se decidió hacer una biblioteca que almacene información de libros. Para cumplir esta función se encontró enlistado en el Internet Archive diferentes API de Open Library:
https://openlibrary.org/dev/docs/api/search
https://openlibrary.org/dev/docs/api/books
Básicamente, esta API accede a una base de datos de Open Library que almacena información de distintos libros, como ediciones publicadas, lugar de publicación, autor, idiomas en las que está disponible la información, descripciones, etc.

Endpoints:
La API proporciona diferentes endpoints para las funciones que proporciona, como la búsqueda de libros, descripciones, la base de datos de imágenes del los autores o las cubiertas de los libros, para esta actividad se utilizarán los siguientes endpoints:
Búsqueda bibliográfica de los libros: 
https://openlibrary.org/search.json
Búsqueda de las descripciones de los libros:
https://openlibrary.org/works/

Parámetros:
Los parámetros que describe la página para la API de búsqueda de los libros son los siguientes:
  q: Consulta Solr. Admite campos dentro del texto como el de lenguaje, que excluye los libros sin edición en ese idioma.
  fields: Campos que devolver. * Devuelve todo. El atributo availability añade disponibilidad de archive.org
  sort: new, old, random, key y otros. Por defecto, relevancia, etc. Se encarga de ordenar los datos.
  lang: Idioma del usuario en dos letras. Influye en qué edición se muestra, pero sin excluir resultados.
  limit+page: Paginación, page empieza en 1.
  Limit+ offset: Paginación alternativa

Formatos de respuesta:
La API de búsqueda suele devolver un objeto con start, numFound (a veces num_found), numFoundExact y el arreglo docs. Cada documento puede traer key, title, author_name, author_key, cover_i, first_publish_year, edition_count, ia, etc.

Códigos de error:
La API no documenta códigos de error como tal, pero investigando códigos de errores típicos de aplicaciones de red y que comentan algunos usuarios, encontramos los siguientes:

  400 Búsqueda inválida
  403 Limite de peticiones por IP en 5 minutos superada (en imagenes)
  404 Portada inexistente
  429 Demasiadas Peticiones
  500 Fallos de Rendimiento
