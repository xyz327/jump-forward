package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed frontend/dist
var assets embed.FS

func main() {
	app := application.New(application.Options{
		Name:        "Jump Forward",
		Description: "SSH Port Forwarding Manager",
		Services: []application.Service{
			application.NewService(NewApp()),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
		SingleInstance: &application.SingleInstanceOptions{
			UniqueID: "com.jump-forward.app",
			OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
				if win, ok := application.Get().Window.GetByName("main"); ok {
					win.Focus()
				}
			},
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:   "main",
		Title:  "Jump Forward",
		Width:  1024,
		Height: 768,
		URL:    "/",
	})

	err := app.Run()
	if err != nil {
		log.Fatal(err)
	}
}
