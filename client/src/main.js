import './style.css'
import { initSpecTabs } from './spec-tabs-state.js'

// Side-effect imports: each wires up its own DOM event listeners / registers
// as a spec-tabs-state subscriber when loaded. Both spec-tabs-strip.js and
// build-workflow.js must be imported (so their onTabsChanged registration
// runs) before initSpecTabs() fires at the bottom.
import './spec-toolbar.js'
import './spec-tabs-strip.js'
import './window-chrome-menu.js'
import './window-chrome-pane.js'
import './window-chrome-guide.js'
import './taskbar-clock.js'
import './build-workflow.js'

initSpecTabs()
