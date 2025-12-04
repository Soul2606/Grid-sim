console.log('hello world')




type Variable = {
	name:string
	val:string|number|boolean|null
}



type CellEntry = {
	cell:CellInstance
	position:Vector2D
}



type Entry<T> = {
	position:Vector2D
	value:T
}



type Instruction = 
 | {
	id:'with_an_x%_chance'
	param:number
	then:Set<Instruction>
}
 | {
	id:'turn into'
	param:Cell|'empty'
}




class Vector2D {
	x:number
	y:number
	constructor(x:number, y:number){
		this.x = x
		this.y = y
	}

	static fromKey(key:string):Vector2D{
		const [x,y] = key.split(',').map(Number)
		if (!x||!y) throw new Error("Invalid string, string should be similar to this: '1,2' to avoid error use only strings from the toKey method in Vector2D");
		return new Vector2D(x,y)
	}

	equals(vec:Vector2D):boolean{
		return (this.x === vec.x && this.y === vec.y)
	}

	toString():string{
		return `x:${this.x},y:${this.y}`
	}

	toKey():string{
		return `${this.x},${this.y}`
	}
}




class Cell {
	private _name:string
	private _icon:string
	publicVariables:Variable[]
	privateVariables:Variable[]
	isReference:boolean // Reference cells can be at multiple places at once
	isFloating:boolean // Floating cells can overlap with other cells and do not block non floating cells
	script:Set<Instruction>
	private valueChangeCalls:Signal<Cell>
	readonly onDeletion:Signal<Cell>
	constructor({name, icon, publicVariables=[], privateVariables=[], isReference=false, isFloating=false}:{name:string, icon:string, publicVariables?:Variable[], privateVariables?:Variable[], isReference?:boolean, isFloating?:boolean}) {
		this._name = name
		this._icon = icon
		this.isReference = isReference
		this.isFloating = isFloating
		this.publicVariables = [...publicVariables]
		this.privateVariables = [...privateVariables]
		this.script = new Set<Instruction>()
		this.valueChangeCalls = new Signal<Cell>()
		this.onDeletion = new Signal<Cell>()
	}

	private callChanges() {
		this.valueChangeCalls.send(this)
	}

	get name():string{
		return this._name
	}

	set name(str:string){
		if (AllCellClasses.cells.some(val=>val.name === str)) return
		this._name = str
		this.callChanges()
	}

	get icon():string{
		return this._icon
	}

	set icon(str:string){
		this._icon = str
		this.callChanges()
	}

	trackChanges(func:(cell:Cell)=>void){
		this.valueChangeCalls.subscribe(func)
	}
}




class CellInstance {
	readonly cell:Cell
	private script:CustomScript
	constructor(cell:Cell) {
		this.cell = cell
		this.script = new CustomScript(cell.script, this)
	}

	tick(deltaMs:number){
		this.script.run()
	}
}




class Signal<P=unknown, R=void> {
	private listeners
	private onceListener
	constructor() {
		this.listeners = new Set<(param:P)=>R>()
		this.onceListener = new Set<(param:P)=>R>()
	}

	subscribe(fnc:(param:P)=>R){
		this.unsubscribe(fnc)
		this.listeners.add(fnc)
		return ()=>this.unsubscribe(fnc)
	}

	once(fnc:(param:P)=>R){
		this.unsubscribe(fnc)
		this.onceListener.add(fnc)
		return ()=>this.unsubscribe(fnc)
	}

	unsubscribe(fnc:(param:P)=>R){
		this.listeners.delete(fnc)
		this.onceListener.delete(fnc)
		return this
	}

	clear(){
		this.listeners.clear()
		this.onceListener.clear()
	}

	send(param:P):R[]{
		const results:R[] = []
		this.listeners.forEach(fnc=>results.push(fnc(param)))
		this.onceListener.forEach(fnc=>{
			results.push(fnc(param))
			this.onceListener.delete(fnc)
		})
		return results
	}
}




class CustomScript {
	readonly instructions:Set<Instruction>
	readonly cellInst:CellInstance
	readonly environment
	constructor(script:Set<Instruction>, cellInst:CellInstance) {
		this.instructions = script
		this.cellInst = cellInst
		this.environment = Grid
	}

	run(){
		const r = (inst:Instruction):void=>{
			switch (inst.id) {
				case 'with_an_x%_chance':
					if (Math.random() < inst.param/100) inst.then.forEach(r)
				break;
				case 'turn into':
					const param = inst.param
					if (param === 'empty') {
						this.environment.getPositions(this.cellInst).forEach(pos=>this.environment.removeCell(pos))
					}else{
						this.environment.getPositions(this.cellInst).forEach(pos=>this.environment.setCell(new CellInstance(param), pos))
					}
				break;
			}
		}
		this.instructions.forEach(r)
	}
}




const Grid = new (class {
	private _size:Vector2D
	private entries:CellEntry[]
	private elements:Entry<HTMLElement>[]
	constructor(size:Vector2D) {
		this._size = size
		this.entries = []
		this.elements = []
	}

	get width():number{
		return this._size.x
	}

	get height():number{
		return this._size.y
	}

	set size(vec:Vector2D){
		this._size = vec
	}

	private updateElements(){
		const entryMap = new Map<string,string>()
		this.entries.forEach(ent=>entryMap.set(ent.position.toKey(), ent.cell.cell.icon))
		this.elements.forEach(el=>el.value.textContent = entryMap.get(el.position.toKey()) ?? '')
	}

	private getCellInstances():CellInstance[] {
		const set = new Set<CellInstance>()
		this.entries.forEach(ent=>set.add(ent.cell))
		return Array.from(set)
	}

	getPositions(cell:CellInstance):Vector2D[]{
		return this.entries.filter(ent=>ent.cell===cell).map(ent=>ent.position)
	}

	entriesAtPos(pos:Vector2D):CellEntry[]{
		return this.entries.filter(ent=>ent.position.equals(pos))
	}

	setCell(cell:CellInstance, position:Vector2D){
		const entryAtPosition = this.entriesAtPos(position).find(ent=>!ent.cell.cell.isFloating)
		if (entryAtPosition && !cell.cell.isFloating) {
			this.entries[this.entries.indexOf(entryAtPosition)] = {cell, position}
		} else if (cell.cell.isReference) {
			this.entries.push({cell, position})
		} else {
			const cellIdx = this.entries.findIndex(ent=>ent.cell===cell)
			if (cellIdx !== -1) this.entries.splice(cellIdx, 1)
			this.entries.push({cell, position})
		}
		this.updateElements()
		return this
	}

	removeCell(position:Vector2D){
		this.entriesAtPos(position).forEach(ent=>this.entries.splice(this.entries.indexOf(ent), 1))
		this.updateElements()
		return this
	}

	startSimulation(){
		const mainGrid = document.getElementById('main-grid')
		if (!mainGrid) throw new Error("Could not find 'main-grid'");

		removeAllChildren(mainGrid)
		mainGrid.style.gridTemplateColumns = '1fr '.repeat(this.width)
		mainGrid.style.gridTemplateRows = '1fr '.repeat(this.height)
		const elements:Entry<HTMLElement>[] = []
		for (let i = 0; i < this.width * this.height; i++) {
			const position = new Vector2D(i%this.width, Math.floor(i/this.width))
			const root = document.createElement('div')
			root.className = 'grid-cell'
			root.addEventListener('click',()=>{
				console.log('x', position.x, 'y', position.y, brushCell)
				if (brushCell instanceof Cell) {
					this.setCell(new CellInstance(brushCell), position)
				} else {
					this.removeCell(position)
				}
				console.log(this.entries)
			})
			mainGrid.appendChild(root)
			elements.push({position,value:root})
		}
		this.elements = elements

		let now = Date.now()
		const tick = ()=>{
			const deltaMs = Date.now()-now; now=Date.now();
			this.getCellInstances().forEach(inst=>inst.tick(deltaMs))
			console.log('tick')
		}
		let intervalID:number|undefined
		clearInterval(intervalID)
		intervalID = setInterval(tick, 50)
	}
})(new Vector2D(30,30));




function removeAllChildren(element:HTMLElement):Element[] {
	const removed:Element[] = []
	while (element.firstElementChild) {
		removed.push(element.firstElementChild)
		element.firstElementChild.remove()
	}
	return removed
}




// Todo: fix enterOnInput to work with emoji's. the solution probably involves composition and addEventListener("compositionstart") and end
function editableTextModule(element:HTMLElement, callbackFunction:(el:HTMLElement, newText:string, oldText:string)=>void, options:{enterOnInput?:true}={}){
	if (element.children.length > 0) {
		console.error(element)
		throw new Error("Element must not have any non text children");
	}
	if (typeof callbackFunction !== 'function') {
		throw new Error("callbackFunction is not a function");
	}
    if (element.contentEditable !== 'true') {
        console.warn(element, `: is not content editable`)
    }

    let shouldRevert = true
    let originalText = element.textContent

	function enterText() {
		callbackFunction(element, element.textContent, originalText)
        originalText = element.textContent
        shouldRevert = false
        element.blur()
	}

    element.addEventListener('focus',e=>{
		e.stopPropagation()
        originalText = element.textContent
    })

    element.addEventListener('blur',()=>{
        if (!shouldRevert) {
            return
        }
        //If revertText
        element.textContent = originalText
    })

	if (!options.enterOnInput) {
		element.addEventListener('keydown',e=>{
			if (e.key !== 'Enter') {
				return
			}
			e.preventDefault()
			enterText()
		})
	}
    
    element.addEventListener('input',(e)=>{
		if (options.enterOnInput) {
			enterText()
		}
        shouldRevert = true
    })
}



function createDropdown(options: string[], onSelect: (idx: number) => void = () => {}, initialIdx?:number): HTMLElement {
	const first = options[0]
	if (!first) throw new Error("Cannot create a dropdown with no options");

	console.log(initialIdx)
	const initialOption = (initialIdx || initialIdx === 0) ? options[initialIdx] : null
	if (initialOption === null) throw new Error("initialIdx is out of range");
	
	const container = document.createElement("div");
	container.className = "dropdown";

	const button = document.createElement("button");
	button.className = "dropdown-toggle";
	button.textContent = initialOption ? initialOption : first;
	
	const list = document.createElement("ul");
	list.className = "dropdown-panel"; 
	list.style.display = 'none'
	list.addEventListener('mouseleave',()=>{
		list.style.display = 'none'
	})
	
	options.forEach((opt, idx) => {
		const li = document.createElement("li");
		li.className = "dropdown-panel-item";
		li.textContent = opt;
		
		li.addEventListener("click", () => {
			onSelect(idx);
			list.style.display = 'none'
			button.textContent = opt
		});
		
		list.appendChild(li);
	});
	
	container.appendChild(list);
	container.appendChild(button);

	button.addEventListener("click", () => {
		list.style.display = ''
	});

	return container;
}




const cellClassesListElement = document.getElementById('cell-classes-list'); if (!cellClassesListElement) throw new Error("could not find 'cell-classes-list'");
const newCellButton = document.getElementById('new-cell-button');if (!newCellButton) throw new Error("Could not find 'new-cell-button'");
const setBrushButton = document.getElementById('set-brush-button');if (!setBrushButton) throw new Error("Could not find 'set-brush-button'");


const rulesNestingDistance = 20 //Pixels
const rulesNestingMax = 6


const windowListener = (()=>{
	type Listener = (event:Event)=>void;
	const subscribers = new Set<Listener>()

	function subscribe(func:Listener) {
		subscribers.add(func)
	}

	function unsubscribe(func:Listener) {
		subscribers.delete(func)
	}

	window.addEventListener('click',e=>{
		subscribers.forEach(f=>f(e))
	})

	return {subscribe, unsubscribe, subscribers:()=>Array.from(subscribers)}
})();



const AllCellClasses = new (class {
	private _cells:Cell[]
	private cellsOnDelete
	constructor(){
		this._cells = []
		/**
		 * Prevents memory leaks. Each signal is cleared before element structure is created, signals are used by the elements.
		 */
		this.cellsOnDelete = new Map<Cell, Signal<Cell>>()
	}

	private updateList(){
		this.cellsOnDelete.forEach(signal=>signal.clear())
		const onDeletion = this.cellsOnDelete
		const cells = this._cells
		function createRecursiveRule(rule:HTMLElement, data:Set<Instruction>, instruction:Instruction, dataFields:Set<Instruction>[], nesting:number):HTMLElement {
			const root = createRuleWrapper(rule, data, instruction)
			for (let i = 0; i < dataFields.length; i++) {
				const data = dataFields[i]
				if (data) root.appendChild(createRulesSection(data,nesting+1))
			}
			return root
		}

		function createRuleWrapper(rule: HTMLElement, data:Set<Instruction>, instruction:Instruction) {
			const root = document.createElement('div')
			root.className = 'cell-class-rule'

			const header = document.createElement('div')
			header.className = 'cell-class-rule-header'

			const remove = document.createElement('button')
			remove.className = 'cell-class-rule-remove'
			remove.textContent = 'remove'
			data.add(instruction)
			remove.addEventListener('click', () => {
				data.delete(instruction)
				root.remove()
			})
			header.appendChild(remove)
			header.appendChild(rule)
			root.appendChild(header)
			return root
		}

		function createRulesSection(data:Set<Instruction>, nesting:number):HTMLElement {
			function createXChance(instruction: Instruction) {
				if (instruction.id !== 'with_an_x%_chance') throw new Error("Wrong instruction id, mut be 'with_an_x%_chance'");
				const rule = document.createElement('p')
				const input = document.createElement('input')
				input.type = 'number'
				input.max = '100'
				input.min = '0'
				input.step = '0.1'
				input.value = String(instruction.param)
				input.addEventListener('input',()=>{
					instruction.param = Number(input.value)
				})
				rule.append('with an', input, '% chance')
				return rule
			}

			function createTurnInto(instruction: Instruction):HTMLParagraphElement {
				const rule = document.createElement('p')
				if (instruction.id !== 'turn into') throw new Error("Wrong instruction id, mut be 'turn into'");
				let initialIdx = 0
				if (instruction.param !== 'empty') {
					initialIdx = cells.findIndex(cell=>cell===instruction.param)+1
				}
				const onSelect = (idx:number)=>{
					if (idx === 0) {
						instruction.param = 'empty'
						return
					}
					const cell = cells[idx - 1]
					if (!cell) {
						instruction.param = 'empty'
						return
					}
					instruction.param = cell
					onDeletion.get(cell)?.subscribe(() => {
						instruction.param = 'empty'
						AllCellClasses.updateList()
					})
				}
				onSelect(initialIdx)
				const dropdown = createDropdown(['empty'].concat(cells.map(cell => cell.name)), onSelect, initialIdx)
				const span = document.createElement('span')
				span.appendChild(dropdown)
				rule.append('turn into', span)
				return rule
			}

			const root = document.createElement('div')
			root.className = 'cell-class-rules'
			root.style.marginLeft = rulesNestingDistance + 'px'
			
			const addNewButton = document.createElement('button')
			addNewButton.className = 'cell-class-new-rule'
			addNewButton.textContent = '+new'
			
			let activeDropdown = false
			const dropdown = document.createElement('div')
			dropdown.tabIndex = 0
			dropdown.className = 'cell-class-new-rule-dropdown'
			dropdown.style.display = 'none'
			const hideDropdown = ()=>{
				dropdown.style.display = 'none'
				activeDropdown = false
			}
			
			if (nesting < rulesNestingMax) {
				const withAnXChance = document.createElement('button')
				withAnXChance.textContent = 'With a X% chance...'
	
				withAnXChance.addEventListener('click', e=>{
					e.stopPropagation()
					console.log('clicked with an X% chance')
					const then = new Set<Instruction>()
					const instruction:Instruction = {
						id:'with_an_x%_chance',
						param:0.5,
						then:then
					}
					root.appendChild(createRecursiveRule(createXChance(instruction), data, instruction, [then], nesting))
					console.log(cells)
					hideDropdown()
				})
	
				dropdown.appendChild(withAnXChance)
			}

			const turnInto = document.createElement('button')
			turnInto.textContent = 'turn into...'

			turnInto.addEventListener('click', e=>{
				e.stopPropagation()
				console.log('clicked turn into')
				const instruction:Instruction = {
					id:'turn into',
					param:'empty'
				} 
				root.appendChild(createRuleWrapper(createTurnInto(instruction), data, instruction))
				hideDropdown()
			})

			dropdown.appendChild(turnInto)
			addNewButton.appendChild(dropdown)

			addNewButton.addEventListener('click',()=>{
				if (activeDropdown) {
					hideDropdown()
					return
				}
				dropdown.style.display = ''
				dropdown.style.minWidth = addNewButton.getBoundingClientRect().width + 'px'
				activeDropdown = true
			})

			root.appendChild(addNewButton)

			data.forEach(instruction=>{
				switch (instruction.id) {
					case 'with_an_x%_chance':
						root.appendChild(createRecursiveRule(createXChance(instruction), data, instruction, [instruction.then], nesting))
					break;
					case "turn into":
						root.appendChild(createRuleWrapper(createTurnInto(instruction), data, instruction))
					break;
					default:
					break;
				}
			})

			return root
		}

		function createCell(cell:Cell) {
			const root = document.createElement('div')
			root.className = 'cell-class'

			const header = document.createElement('div')
			header.className = 'cell-class-header'

			const icon = document.createElement('h3')
			icon.textContent = cell.icon
			icon.contentEditable = 'true'
			editableTextModule(icon, (el,newText)=>{
				cell.icon = newText
			})
			cell.trackChanges(()=>{
				icon.textContent = cell.icon
			})
			header.appendChild(icon)
			
			const h = document.createElement('h3')		
			h.textContent = cell.name
			h.contentEditable = 'true'
			editableTextModule(h,(el,newText,oldText)=>{
				cell.name = newText
				AllCellClasses.updateList()
			})
			header.appendChild(h)

			const remove = document.createElement('button')
			header.appendChild(remove)
			root.appendChild(header)

			const settings = document.createElement('div')
			settings.className = 'cell-class-settings'
			root.appendChild(settings)

			root.appendChild(createRulesSection(cell.script, 0))

			return root
		}

		removeAllChildren(cellClassesListElement)
		this._cells.map(createCell).forEach(val=>cellClassesListElement.appendChild(val))
	}

	get cells():readonly Cell[]{
		return this._cells
	}

	addCell(cell:Cell):boolean{
		if (this._cells.includes(cell)) return false
		if (this._cells.some(v=>v.name === cell.name)) return false
		this._cells.push(cell)
		this.cellsOnDelete.set(cell,new Signal())
		cell.onDeletion.once(()=>{
			this.cellsOnDelete.get(cell)?.send(cell)
		})
		this.updateList()
		return true
	}
})()





newCellButton.addEventListener('click', ()=>{
	let i = ''
	while (!AllCellClasses.addCell(new Cell({name:'New thing'+i, icon:'🌲'}))){
		if (i===''){
			i='1'
		}else{
			i=String(Number(i)+1)
		}
	}
	console.log(AllCellClasses.cells)
})



let brushCell:Cell|'empty' = 'empty' as const
{
	let i = -1
	setBrushButton.addEventListener('click',()=>{
		i++
		if (i >= AllCellClasses.cells.length) i = -1
		const cell = AllCellClasses.cells[i]
		if (cell) {
			brushCell = cell
			setBrushButton.textContent = cell.icon
		} else {
			brushCell = 'empty'
			setBrushButton.textContent = ''
		}
		console.log(i)
	})

	for (const cell of AllCellClasses.cells) {
		cell.trackChanges(()=>{
			if (cell.icon === brushCell) setBrushButton.textContent = cell.icon
		})
	}
}


Grid.startSimulation()

