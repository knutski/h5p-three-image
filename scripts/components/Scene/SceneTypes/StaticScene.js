import React from 'react';
import './StaticScene.scss';
import NavigationButton, {getIconFromInteraction, Icons} from "../../Shared/NavigationButton";
import {H5PContext} from "../../../context/H5PContext";
import {SceneTypes} from "../Scene";
import ContextMenu from "../../Shared/ContextMenu";

export default class StaticScene extends React.Component {
  constructor(props) {
    super(props);

    this.sceneWrapperRef = React.createRef();
    this.imageElementRef = React.createRef();

    this.state = {
      x: null,
      y: null,
      draggingInteractionIndex: null,
      isDragDelayed: true,
      draggingElement: null,
      isVerticalImage: false,
    };

    /**
     *  Note: Need to bind function reference once in the constructor
     *        otherwise EventListener will not be removed, since it will
     *        think it is a new function reference if we bind it when creating
     *        the listener.
     *        @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind}
     */
    this.onMove = this.onMove.bind(this);
    this.stoppedDragging = this.stoppedDragging.bind(this);
  }

  getWrapperSize(isVertical = false) {
    let wrapper = this.sceneWrapperRef.current;
    return isVertical ? wrapper.clientHeight : wrapper.clientWidth;
  }

  getDraggingInteraction() {
    if (this.state.draggingInteractionIndex === null) {
      return false;
    }

    const interactions = this.props.sceneParams.interactions;
    return interactions[this.state.draggingInteractionIndex];
  }

  getMouseMovedPercentages(mouseEvent, isVertical = false) {
    let startPos = this.startX;
    let wrapperSize = this.getWrapperSize(isVertical);
    let mousePos = mouseEvent.clientX;

    if (isVertical) {
      startPos = this.startY;
      mousePos = mouseEvent.clientY;
    }

    return ((startPos - mousePos) / wrapperSize) * 100;
  }

  removePercentageDenotationFromPosition(position) {
    const lastChar = position.charAt(position.length - 1);
    if (lastChar !== '%') {
      return false;
    }

    return position.substr(0, position.length - 1);
  }

  getPositions(positions) {
    const pos = positions.split(',');
    return {
      x: pos[0],
      y: pos[1],
    };
  }

  getNewInteractionPosition(initialPos, mouseEvent, element, isVertical = false) {
    let position = initialPos.x;
    let mouseMoved = this.getMouseMovedPercentages(mouseEvent, isVertical);
    let wrapperSize = this.getWrapperSize(isVertical);

    if (isVertical) {
      position = initialPos.y;
    }

    position = this.removePercentageDenotationFromPosition(position);
    const movedTo = position - mouseMoved;

    if (movedTo < 0) {
      return 0;
    }

    const elementBounds = element.getBoundingClientRect();
    const elementSize = isVertical ? elementBounds.height : elementBounds.width;
    const elementSizePercentage = (elementSize / wrapperSize) * 100;
    const positionThreshold = 100 - elementSizePercentage;

    if (movedTo > positionThreshold) {
      return positionThreshold;
    }

    return movedTo;
  }

  getNewInteractionPositions(mouseEvent) {
    const interaction = this.getDraggingInteraction();
    const initialPos = this.getPositions(interaction.interactionpos);

    const xPos = this.getNewInteractionPosition(
      initialPos,
      mouseEvent,
      this.state.draggingElement,
    );

    const yPos = this.getNewInteractionPosition(
      initialPos,
      mouseEvent,
      this.state.draggingElement,
      true,
    );

    return {
      x: xPos,
      y: yPos,
    };
  }

  startDragging(interactionIndex, e) {
    if (e.button !== 0) {
      return;
    }

    this.startX = e.clientX;
    this.startY = e.clientY;

    document.body.addEventListener('mousemove', this.onMove);
    document.body.addEventListener('mouseup', this.stoppedDragging);

    this.setState({
      draggingInteractionIndex: interactionIndex,
      draggingElement: e.target,
      isDragDelayed: true,
    });

    // Small delay to not accidentally drag interactions when double clicking
    setTimeout(() => {
      this.setState({
        isDragDelayed: false,
      });
    }, 50);
  }

  onMove(e) {
    const isDragging = this.state.draggingInteractionIndex !== null;
    const isDragDelayed = this.state.isDragDelayed;
    if (!isDragging || isDragDelayed) {
      return;
    }
    this.setState(this.getNewInteractionPositions(e));
  }

  stoppedDragging() {
    if (this.state.draggingInteractionIndex === null) {
      return;
    }

    document.body.removeEventListener('mousemove', this.onMove);
    document.body.removeEventListener('mouseup', this.stoppedDragging);

    // State has not been updated, most likely a double-click
    if (this.state.x === null || this.state.y === null) {
      this.setState({
        x: null,
        y: null,
        draggingInteractionIndex: null,
        draggingElement: null,
        isDragDelayed: true,
      });
      return;
    }

    const interaction = this.getDraggingInteraction();
    interaction.interactionpos = [
      this.state.x + '%',
      this.state.y + '%',
    ].join(',');

    this.setState({
      x: null,
      y: null,
      draggingInteractionIndex: null,
      draggingElement: null,
      isDragDelayed: true,
    });
  }

  goToPreviousScene() {
    if (this.props.sceneHistory.length > 0) {
      this.props.navigateToScene(SceneTypes.PREVIOUS_SCENE);
    }
  }

  onSceneLoaded() {
    const imageElement = this.imageElementRef.current;
    const ratio = imageElement.naturalWidth / imageElement.naturalHeight;
    const viewRatio = 16 / 9;
    this.setState({
      isVerticalImage: ratio < viewRatio,
    });
  }

  render() {
    if (!this.props.isActive) {
      return null;
    }

    const interactions = this.props.sceneParams.interactions || [];

    const hasPreviousScene = this.props.sceneHistory.length > 0;
    const isShowingBackButton = this.props.sceneParams.showBackButton
      && (hasPreviousScene || this.context.extras.isEditor);

    const backButtonClasses = this.context.extras.isEditor
      && !hasPreviousScene
      ? ['disabled']
      : [];

    const imageSceneClasses = ['image-scene-wrapper'];
    if (this.state.isVerticalImage) {
      imageSceneClasses.push('vertical');
    }

    return (
      <div className='image-scene-overlay'>
        <div
          className={imageSceneClasses.join(' ')}
          ref={this.sceneWrapperRef}
        >
          <img
            className='image-scene'
            src={this.props.imageSrc}
            onLoad={this.onSceneLoaded.bind(this)}
            ref={this.imageElementRef}
          />
          {
            interactions.map((interaction, index) => {
              const pos = this.getPositions(interaction.interactionpos);
              let posX = this.removePercentageDenotationFromPosition(pos.x);
              let posY = this.removePercentageDenotationFromPosition(pos.y);
              const hasUpdatedPositions = this.state.x !== null
                && this.state.y !== null
                && this.state.draggingInteractionIndex === index;
              if (hasUpdatedPositions) {
                posX = this.state.x;
                posY = this.state.y;
              }

              const buttonClasses = [];
              if (this.props.audioIsPlaying === 'interaction-' + this.props.sceneId + '-' + index) {
                buttonClasses.push('active');
              }

              if (posX > 91.5) {
                buttonClasses.push('left-aligned');
              }

              let title = interaction.action.metadata.title;
              const library = H5P.libraryFromString(interaction.action.library);
              const machineName = library.machineName;

              const isGoToSceneInteraction = machineName === 'H5P.GoToScene';
              if (isGoToSceneInteraction) {
                const nextScene = this.context.params.scenes.find(scene => {
                  return scene.sceneId === interaction.action.params.nextSceneId;
                });
                title = nextScene.scenename;
              }

              return (
                <NavigationButton
                  key={index}
                  title={title}
                  icon={getIconFromInteraction(interaction)}
                  topPosition={posY}
                  leftPosition={posX}
                  mouseDownHandler={this.startDragging.bind(this, index)}
                  clickHandler={this.props.showInteraction.bind(this, index)}
                  doubleClickHandler={() => {
                    this.context.trigger('doubleClickedInteraction', index);
                  }}
                  buttonClasses={ buttonClasses }
                  onBlur={this.props.onBlurInteraction}
                  isFocused={this.props.focusedInteraction === index}
                >
                  {
                    this.context.extras.isEditor &&
                    <ContextMenu
                      isGoToScene={isGoToSceneInteraction}
                      interactionIndex={index}
                    />
                  }
                </NavigationButton>
              );
            })
          }
        </div>
        {
          isShowingBackButton &&
          <NavigationButton
            title='Back'
            icon={Icons.GO_BACK}
            clickHandler={this.goToPreviousScene.bind(this)}
            forceClickHandler={true}
            buttonClasses={backButtonClasses}
          />
        }
      </div>
    );
  }
}

StaticScene.contextType = H5PContext;
