package main

import (
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"runtime"
)

const port = "3333"

func main() {
	_, filename, _, _ := runtime.Caller(0)
	dir := filepath.Dir(filename)

	http.Handle("/", http.FileServer(http.Dir(dir)))

	fmt.Println("Servidor en http://localhost:" + port)
	log.Fatal(http.ListenAndServe("127.0.0.1:"+port, nil))
}
