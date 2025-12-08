console.log('hello world')


type ArrayIndex<T extends readonly unknown[]> = Extract<keyof T, `${number}`> extends `${infer N extends number}` ? N : never;



interface VariableSignals<T extends VariableTypes = VariableTypes> {
	get changeSignal():SignalPublic<T>
	get deleteSignal():SignalPublic<string>
}
type VariableTypes = number | string | boolean | null
class Variable<T extends VariableTypes = VariableTypes> implements VariableSignals {
	private _name
	private _value:T
	private changeSignalPrivate
	private _changeNameSignal
	private deleteSignalPrivate
	constructor(name:string, value:T) {
		this._name = name
		this._value = value
		this.changeSignalPrivate = new Signal<VariableTypes>()
		this._changeNameSignal = new Signal<string>()
		this.deleteSignalPrivate = new Signal<string>()
	}

	get name():string{
		return this._name
	}

	set name(newName:string){
		this._name = newName
		this._changeNameSignal.send(newName)
	}

	get value():T {
		return this._value
	}
	
	set value(v:T) {
		this._value = v;
		this.changeSignalPrivate.send(v)
	}

	get changeSignal(){
		return this.changeSignalPrivate.createPublic()
	}

	get changeNameSignal(){
		return this._changeNameSignal.createPublic()
	}

	get deleteSignal(){
		return this.deleteSignalPrivate.createPublic()
	}

	getTypeName():string{
		return this._value === null? 'null' : typeof this._value
	}

	callDelete(){
		this.deleteSignalPrivate.send(this._name)
	}
}



type CellEntry = {
	cell:CellInstance
	position:Vector2D
}



type Entry<T> = {
	position:Vector2D
	value:T
}



type NumberComparison = 'at least'|'at most'|'less than'|'more than'|'exactly'
function numComp(value:number, op:NumberComparison, comparison:number):boolean{
	switch (op) {
		case 'at least':
			return value >= comparison
		case "at most":
			return value <= comparison
		case "less than":
			return value < comparison
		case "more than":
			return value > comparison
		case "exactly":
			return value === comparison
		default:
			console.warn('numComp has missing case')
		return false
	}
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
 | {
	id:'if neighbors'
	param:{condition:NumberComparison, value:number, cell:Cell|'empty'}
	then:Set<Instruction>
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
	private variables:Set<Variable>
	isReference:boolean // Reference cells can be at multiple places at once
	isFloating:boolean // Floating cells can overlap with other cells and do not block non floating cells
	script:Set<Instruction>
	private valueChangeCalls:Signal<Cell>
	readonly onDeletion:Signal<Cell>
	constructor({name, icon, isReference=false, isFloating=false}:{name:string, icon:string, isReference?:boolean, isFloating?:boolean}) {
		this._name = name
		this._icon = icon
		this.isReference = isReference
		this.isFloating = isFloating
		this.variables = new Set<Variable>()
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

	get onChange(){
		return this.valueChangeCalls.createPublic()
	}

	addVariable<T extends VariableTypes>(name:string, value:T){
		if (Array.from(this.variables).some(v=>v.name === name)) {
			console.log('a variable with this name already exist. name: ', name)
			return null
		}
		const variable = new Variable<T>(name, value)
		this.variables.add(variable)
		return variable
	}

	deleteVariable(name:string):boolean{
		const variable = Array.from(this.variables).find(v=>v.name === name)
		if (!variable) return false
		this.variables.delete(variable)
		return true
	}

	getVariables():readonly Variable[]{
		return Array.from(this.variables)
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
		})
		this.onceListener.clear()
		return results
	}

	createPublic(){
		return new SignalPublic(this)
	}
}

// A class exposing only subscriber-management methods.
// No access to send().
class SignalPublic<P = unknown, R = void> {
	private readonly signal: Signal<P, R>;

	constructor(signal: Signal<P, R>) {
		this.signal = signal;
	}

	subscribe(fnc: (param: P) => R):()=>void {
		return this.signal.subscribe(fnc);
	}

	once(fnc: (param: P) => R) {
		this.signal.once(fnc);
		return this
	}

	unsubscribe(fnc: (param: P) => R) {
		this.signal.unsubscribe(fnc);
		return this
	}

	clear() {
		this.signal.clear();
		return this
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
				case "if neighbors":
					if (numComp(this.environment.getNeighbors(this.cellInst).filter(ent=>ent.cell.cell === inst.param.cell).length, inst.param.condition, inst.param.value)) {
						inst.then.forEach(r)
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

	getNeighbors(cell: CellInstance): CellEntry[] {
		const entries: CellEntry[] = this.getPositions(cell).map(pos => ({ cell, position: pos }));

		// Define all relative neighbor offsets (including diagonals + same cell)
		const offsets = [
			{ x: 0, y: 0 },   // same position
			{ x: 0, y: 1 },   // up
			{ x: 0, y: -1 },  // down
			{ x: 1, y: 0 },   // right
			{ x: 1, y: 1 },   // top-right
			{ x: 1, y: -1 },  // bottom-right
			{ x: -1, y: 0 },  // left
			{ x: -1, y: 1 },  // top-left
			{ x: -1, y: -1 }  // bottom-left
		];

		return this.entries.filter(tent =>
			entries.some(ent =>
				offsets.some(offset =>
					tent.position.x === ent.position.x + offset.x &&
					tent.position.y === ent.position.y + offset.y
				) && tent.cell !== ent.cell // exclude itself
			)
		);
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




function editableTextModule(element:HTMLElement, callbackFunction:(el:HTMLElement, newText:string, oldText:string)=>void, options:{onInput?:'call'}={}){
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
	let isComposing = false

	function enterText() {
		if (options.onInput !== 'call') callbackFunction(element, element.textContent, originalText)
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

	if (options.onInput !== 'call') {
		element.addEventListener('keydown',e=>{
			if (e.key !== 'Enter') {
				return
			}
			e.preventDefault()
			enterText()
		})
	}

	element.addEventListener('compositionstart', ()=>isComposing = true)
	element.addEventListener('compositionend', ()=>{
		isComposing = false
		if (options.onInput === 'call') {
			callbackFunction(element, element.textContent, originalText)
			originalText = element.textContent
			shouldRevert = false
		}
	})

	element.addEventListener('input',()=>{
		if (options.onInput === 'call') {
			if (isComposing) return
			callbackFunction(element, element.textContent, originalText)
			originalText = element.textContent
			shouldRevert = false
		} else {
			shouldRevert = true
		}
	})
}



function createDropdown<T extends readonly string[]>(button:HTMLButtonElement, options: T, onSelect: (idx: ArrayIndex<T>) => void = () => {}): HTMLElement {	
	const container = document.createElement("div");
	container.className = "dropdown";

	button.classList.add("dropdown-toggle");
	
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
			list.style.display = 'none'
			onSelect(idx as ArrayIndex<T>);
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



function createVariable(variable:Variable, unsubscribeSignal:Signal):HTMLElement {
	const root = document.createElement('div')
	root.className = 'variable'
	const name = document.createElement('p')
	name.className = 'variable-name'
	name.textContent = variable.name
	//This might looks confusing, .subscribe() returns an unsubscribe() function. that's the function that is being called once when the unsubscribeSignal is sent
	unsubscribeSignal.once(variable.changeNameSignal.subscribe(newName=>name.textContent = newName))
	root.append(name)

	const type = document.createElement('p')
	type.className = 'variable-type'
	type.textContent = variable.getTypeName()
	root.append(type)

	const value = document.createElement('p')
	value.className = 'variable-value'
	value.textContent = String(variable.value)
	unsubscribeSignal.once(variable.changeSignal.subscribe((newValue)=>value.textContent = String(newValue)))
	root.append(value)

	return root
}



function createCellSelectionDropdown(initial:'empty'|Cell, cells:Cell[], onSelect:(selected:'empty'|Cell)=>void=()=>{}):HTMLElement {
	let initialIdx = 0
	if (initial !== 'empty') {
		initialIdx = cells.findIndex(cell=>cell===initial)+1
	}
	const options = ['empty'].concat(cells.map(cell => cell.name))
	const openDropdown = document.createElement('button')
	const _onSelect = (idx:number)=>{
		openDropdown.textContent = String(options[idx])
		if (idx === 0) {
			initial = 'empty'
			onSelect(initial)
			return
		}
		const cell = cells[idx - 1]
		if (!cell) {
			initial = 'empty'
			onSelect(initial)
			return
		}
		initial = cell
		onSelect(initial)
	}
	_onSelect(initialIdx)
	return createDropdown(openDropdown, options, _onSelect)
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
	private resetEverything
	private cellsOnDelete
	private cellsOnChange
	constructor(){
		this._cells = []
		this.resetEverything = new Signal()
		/**
		 * Prevents memory leaks. Each signal is cleared before element structure is created, signals are used by the elements.
		 */
		this.cellsOnDelete = new Signal()
		this.cellsOnChange = new Signal()
	}

	private updateList(){
		this.resetEverything.send(null)
		this.cellsOnDelete.clear()
		const onDeletion = this.cellsOnDelete
		this.cellsOnChange.clear()
		const onChange = this.cellsOnChange
		const resetEverythingSignal = this.resetEverything
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
			function createXChance(instruction: Instruction):HTMLParagraphElement {
				if (instruction.id !== 'with_an_x%_chance') throw new Error("Wrong instruction id, must be 'with_an_x%_chance'");
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
				if (instruction.id !== 'turn into') throw new Error("Wrong instruction id, must be 'turn into'");
				let initialIdx = 0
				if (instruction.param !== 'empty') {
					initialIdx = cells.findIndex(cell=>cell===instruction.param)+1
				}
				const options = ['empty'].concat(cells.map(cell => cell.name))
				const openDropdown = document.createElement('button')
				const onSelect = (idx:number)=>{
					openDropdown.textContent = String(options[idx])
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
				}
				onSelect(initialIdx)
				const dropdown = createDropdown(openDropdown, options, onSelect)
				const span = document.createElement('span')
				span.appendChild(dropdown)
				rule.append('turn into', span)
				return rule
			}

			function createIfNeighbor(instruction:Instruction):HTMLParagraphElement {
				if (instruction.id !== 'if neighbors') throw new Error("Wrong instruction id, must be 'if neighbors'");
				const rule = document.createElement('p')
				const p = ()=>{
					removeAllChildren(rule)
					const selectCondition = (()=>{
						const selectConditionButton = document.createElement('button')
						selectConditionButton.textContent = instruction.param.condition
						const arr = ['at least','at most','less than','more than','exactly'] as const
						return createDropdown(selectConditionButton, arr, idx=>{						 
							selectConditionButton.textContent = arr[idx]
							instruction.param.condition = arr[idx]
						})
					})()

					const selectValue = document.createElement('input')
					selectValue.type = 'number'
					selectValue.max = '8'
					selectValue.min = '0'
					selectValue.value = String(instruction.param.value)
					selectValue.addEventListener('input',()=>{
						instruction.param.value = Number(selectValue.value)
					})

					const selectCell = createCellSelectionDropdown(instruction.param.cell, cells, selected=>{
						instruction.param.cell = selected
					})

					rule.append('if', selectCondition, selectValue, 'are', selectCell)
				}
				p()
				onChange.subscribe(p)
				return rule
			}

			const root = document.createElement('div')
			root.className = 'cell-class-rules'
			root.style.marginLeft = rulesNestingDistance + 'px'
			
			const addNewButton = document.createElement('button')
			addNewButton.className = 'cell-class-new-rule'
			addNewButton.textContent = '+new'
			
			const dropdown = createDropdown(addNewButton, ['With a X% chance...', 'turn into...', 'If neighbors...'], idx=>{
				if (idx === 0) {
					if (nesting < rulesNestingMax) {
						console.log('clicked with an X% chance')
						const then = new Set<Instruction>()
						const instruction:Instruction = {
							id:'with_an_x%_chance',
							param:0.5,
							then:then
						}
						root.appendChild(createRecursiveRule(createXChance(instruction), data, instruction, [then], nesting))
						console.log(cells)
					}else{
						console.log('max nesting reached', nesting)
					}
				} else if (idx === 1) {
					console.log('clicked turn into')
					const instruction:Instruction = {
						id:'turn into',
						param:'empty'
					} 
					root.appendChild(createRuleWrapper(createTurnInto(instruction), data, instruction))
				} else if (idx ===2) {
					if (nesting < rulesNestingMax) {
						console.log('If neighbors')
						const then = new Set<Instruction>()
						const instruction:Instruction = {
							id:'if neighbors',
							param:{
								condition:'at least',
								value:1,
								cell:'empty'
							},
							then:then
						}
						root.appendChild(createRecursiveRule(createIfNeighbor(instruction),data, instruction, [then], nesting))
					} else {
						console.log('max nesting reached', nesting)
					}
				}
			})

			root.appendChild(dropdown)

			data.forEach(instruction=>{
				switch (instruction.id) {
					case 'with_an_x%_chance':
						root.appendChild(createRecursiveRule(createXChance(instruction), data, instruction, [instruction.then], nesting))
					break;
					case "turn into":
						root.appendChild(createRuleWrapper(createTurnInto(instruction), data, instruction))
					break;
					case "if neighbors":
						root.appendChild(createRecursiveRule(createIfNeighbor(instruction), data, instruction, [instruction.then], nesting))
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
			},{onInput:'call'})
			onChange.subscribe(()=>{
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
			settings.textContent = 'Options: coming soon...'
			root.appendChild(settings)
	
			const variablesLi = document.createElement('div')
			variablesLi.className = 'cell-class-variables-list'
			variablesLi.appendChild((()=>{
				const root = document.createElement('button')
				root.className = 'create-new-variable-button'
				root.textContent = 'New Variable'
				root.addEventListener('click',()=>{
					const newVar = cell.addVariable<number>('new variable', 0)
					console.log(newVar, cell)
					if (!newVar) return
					variablesLi.appendChild(createVariable(newVar, resetEverythingSignal))
				})
				return root
			})())
			root.appendChild(variablesLi)

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
		cell.onDeletion.once(()=>{
			this.cellsOnDelete.send(undefined)
		})
		cell.onChange.once(()=>{
			this.cellsOnChange.send(undefined)
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
		cell.onChange.subscribe(()=>{
			if (cell.icon === brushCell) setBrushButton.textContent = cell.icon
		})
	}
}


Grid.startSimulation()

