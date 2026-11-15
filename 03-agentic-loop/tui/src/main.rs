mod app;
mod bridge;
mod ui;

use std::io;
use std::panic;

use crossterm::event::{DisableMouseCapture, EnableMouseCapture, Event, KeyEventKind};
use crossterm::execute;
use crossterm::terminal::{
    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
};
use ratatui::backend::CrosstermBackend;
use ratatui::Terminal;

use app::{App, Config, Connection};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    if std::env::args()
        .skip(1)
        .any(|argument| argument == "--help" || argument == "-h")
    {
        print_help();
        return Ok(());
    }

    let config = match Config::from_args() {
        Ok(config) => config,
        Err(error) => {
            eprintln!("{error}\n");
            print_help();
            std::process::exit(2);
        }
    };

    if config.check {
        return run_check(config);
    }

    run_tui(config)
}

fn run_tui(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let mut app = App::new(config);
    app.refresh();

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;

    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let hook = panic::take_hook();
    panic::set_hook(Box::new(move |info| {
        let _ = disable_raw_mode();
        let _ = execute!(io::stdout(), LeaveAlternateScreen, DisableMouseCapture);
        hook(info);
    }));

    let result = run_app(&mut terminal, &mut app);

    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    result?;

    Ok(())
}

fn run_app(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>, app: &mut App) -> io::Result<()> {
    loop {
        terminal.draw(|frame| ui::draw(frame, app))?;

        if let Event::Key(key) = crossterm::event::read()? {
            if key.kind == KeyEventKind::Press {
                app.handle_key(key);
            }
        }

        if app.should_quit {
            return Ok(());
        }
    }
}

fn run_check(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let mut app = App::new(config);
    app.refresh();

    println!("connection: {}", app.connection.label());

    if let Some(status) = &app.status {
        println!("store: {}", status.store_path);
        println!("agent_store: {}", status.agent_store_path);
        println!(
            "adapters: {}",
            if status.execution_adapters.is_empty() {
                "(none)".to_string()
            } else {
                status.execution_adapters.join(", ")
            }
        );
        println!("agents_registered: {}", status.agent_count);
        println!("tasks_total: {}", status.tasks.total);
    }

    println!("agents_loaded: {}", app.agents.len());
    println!("tasks_loaded: {}", app.tasks.len());

    if let Connection::Disconnected(error) = &app.connection {
        println!("error: {error}");
        std::process::exit(1);
    }

    Ok(())
}

fn print_help() {
    println!(
        r#"Agentic Loop TUI — Rust + Ratatui

Uso:
  agentic-loop-tui [opciones]

Opciones:
  --bridge <ruta>   Ruta al bridge JS (default: dist/infrastructure/cli/bridge.js)
  --node <ruta>     Ejecutable de Node (default: node)
  --store <ruta>    Store de tareas (default: .agentic-loop/tasks.json)
  --check           Imprime el estado de conexión y sale, sin abrir la TUI
  -h, --help        Muestra esta ayuda

Variables de entorno:
  AGENTIC_LOOP_BRIDGE   Ruta al bridge JS
  AGENTIC_LOOP_NODE     Ejecutable de Node
  AGENTIC_LOOP_STORE    Store de tareas

Ejemplos:
  pnpm build
  cargo run --manifest-path tui/Cargo.toml
  cargo run --manifest-path tui/Cargo.toml -- --check
  cargo run --manifest-path tui/Cargo.toml -- --store .agentic-loop/demo.json"#
    );
}
