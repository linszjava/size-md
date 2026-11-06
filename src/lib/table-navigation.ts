import { $prose } from '@milkdown/kit/utils';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { goToNextCell, addRowAfter, isInTable } from '@milkdown/kit/prose/tables';
export const tableNavigation = $prose(() => new Plugin({props:{handleKeyDown(view,event){
  if(event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey||!isInTable(view.state))return false;
  event.preventDefault();
  if(event.shiftKey){goToNextCell(-1)(view.state,view.dispatch);return true;}
  if(goToNextCell(1)(view.state,view.dispatch))return true;
  // Apply insertion and caret movement in one transaction, so Undo removes just this new row.
  addRowAfter(view.state,tr=>{
    const intermediate=view.state.apply(tr);
    goToNextCell(1)(intermediate,next=>{tr.setSelection(TextSelection.create(tr.doc,next.selection.from));});
    view.dispatch(tr.scrollIntoView());
  });
  return true;
}}}));
